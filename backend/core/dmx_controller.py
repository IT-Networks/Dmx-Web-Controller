"""Art-Net DMX Controller"""
import socket
import struct
import time
import logging
from typing import List

logger = logging.getLogger(__name__)


class ArtNetController:
    """Art-Net DMX Controller with error handling and reconnection"""

    ARTNET_PORT = 6454
    ARTNET_HEADER = b'Art-Net\x00'
    OPCODE_DMX = 0x5000
    PROTOCOL_VERSION = 14

    def __init__(self):
        self.sock = None
        self.error_count = 0
        self.last_error_time = 0
        self._init_socket()

    def _init_socket(self):
        """Initialize or reinitialize socket"""
        try:
            if self.sock:
                self.sock.close()
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            self.sock.settimeout(1.0)  # 1 second timeout
            logger.info("Art-Net socket initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Art-Net socket: {e}")
            raise

    def send_dmx(self, ip: str, universe: int, channels: List[int]) -> bool:
        """Sendet DMX via Art-Net with error handling"""
        try:
            # Validate inputs
            if not channels or len(channels) > 512:
                logger.warning(f"Invalid channel count: {len(channels)}")
                return False

            # ArtNet DMX packet format:
            # - Must send even number of channels (ArtNet spec)
            # - Always send full 512 channels for consistency
            num_channels = 512

            # Get/increment sequence number for this universe
            if not hasattr(self, 'sequences'):
                self.sequences = {}
            if universe not in self.sequences:
                self.sequences[universe] = 1
            else:
                self.sequences[universe] = (self.sequences[universe] + 1) % 256

            sequence = self.sequences[universe]

            # Build packet header (18 bytes)
            header = bytearray(18)
            header[0:8] = self.ARTNET_HEADER              # "Art-Net\x00"
            header[8:10] = struct.pack('<H', self.OPCODE_DMX)  # OpOutput = 0x5000
            header[10:12] = struct.pack('>H', self.PROTOCOL_VERSION)  # ProtVer = 14
            header[12] = sequence                          # Sequence (1-255, helps detect lost packets)
            header[13] = 0                                 # Physical port
            header[14:16] = struct.pack('<H', universe)    # Universe (little-endian)
            header[16:18] = struct.pack('>H', num_channels)  # Length (big-endian)

            # Build data payload (512 bytes)
            # Ensure all 512 channels are sent, padding with 0 if needed
            data = bytearray(num_channels)
            for i in range(min(len(channels), num_channels)):
                data[i] = max(0, min(255, int(channels[i])))  # Clamp to 0-255

            # Combine header + data
            packet = header + data

            # Send complete packet (18 + 512 = 530 bytes)
            bytes_sent = self.sock.sendto(packet, (ip, self.ARTNET_PORT))

            if bytes_sent != len(packet):
                logger.warning(f"ArtNet packet size mismatch: sent {bytes_sent} bytes, expected {len(packet)}")

            # Reset error count on success
            if self.error_count > 0:
                self.error_count = 0
                logger.info(f"Art-Net communication recovered for {ip}")

            return True

        except socket.timeout:
            logger.warning(f"DMX send timeout to {ip}")
            return False
        except socket.error as e:
            self.error_count += 1
            current_time = time.time()

            # Log only if it's a new error or 10 seconds passed
            if current_time - self.last_error_time > 10:
                logger.error(f"DMX socket error to {ip}: {e} (count: {self.error_count})")
                self.last_error_time = current_time

            # Try to reinitialize socket after 5 errors
            if self.error_count >= 5:
                logger.warning("Attempting to reinitialize Art-Net socket")
                try:
                    self._init_socket()
                    self.error_count = 0
                except Exception as reinit_error:
                    logger.error(f"Socket reinit failed: {reinit_error}")

            return False
        except Exception as e:
            logger.error(f"Unexpected DMX send error to {ip}: {e}")
            return False
