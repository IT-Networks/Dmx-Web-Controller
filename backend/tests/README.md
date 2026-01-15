# DMX Web Controller - Test Suite

Comprehensive test suite for the DMX Web Controller backend.

## 📁 Test Structure

```
backend/tests/
├── conftest.py              # Pytest fixtures and configuration
├── test_main.py             # API endpoint tests
├── test_effects.py          # Effect engine tests
├── test_custom_effects.py   # Visual Designer tests
└── README.md                # This file
```

## 🧪 Test Coverage

### API Endpoints (`test_main.py`)
- **Health Endpoints**: Root, docs, API status
- **Device Management**: CRUD operations, validation
- **Scene Management**: Create, activate, delete
- **Group Management**: Create, set master intensity
- **Effect Management**: Create, start, stop, delete
- **Fixture Library**: Get fixtures, validate structure

### Effect Engine (`test_effects.py`)
- **Easing Functions**: Linear, ease-in, ease-out, ease-in-out
- **Spot Effects**: Color interpolation, full range
- **Strip Effects**: Solid, wave, chase, gradient patterns
- **Resource Limits**: MAX_EFFECTS, MAX_SEQUENCES

### Custom Effects (`test_custom_effects.py`)
- **Spot Mode**: Keyframe structure, interpolation, templates
- **Strip Mode**: Pattern types, parameters, validation
- **Templates**: Fade, pulse, color cycle, strobe
- **Execution**: Start, stop, validation

## 🚀 Running Tests

### Run All Tests
```bash
cd backend
pytest
```

### Run Specific Test File
```bash
pytest tests/test_main.py
pytest tests/test_effects.py
pytest tests/test_custom_effects.py
```

### Run Specific Test Class
```bash
pytest tests/test_main.py::TestDeviceEndpoints
pytest tests/test_effects.py::TestEasingFunctions
```

### Run Specific Test
```bash
pytest tests/test_main.py::TestDeviceEndpoints::test_add_device_rgb
```

### With Coverage Report
```bash
pytest --cov=backend --cov-report=html
```

### With Verbose Output
```bash
pytest -v
pytest -vv  # Extra verbose
```

### Run Only Fast Tests (skip slow integration tests)
```bash
pytest -m "not slow"
```

## 📊 Test Statistics

- **Total Tests**: 60+
- **API Endpoint Tests**: 25+
- **Effect Engine Tests**: 20+
- **Custom Effects Tests**: 15+

## 🔧 CI/CD Integration

Tests run automatically in GitHub Actions on:
- Push to `main` branch
- Pull requests to `main` branch

The CI/CD pipeline:
1. Sets up Python 3.11
2. Installs dependencies from `requirements.txt`
3. Installs pytest and pytest-asyncio
4. Runs all tests with coverage
5. Reports results in PR comments

## 📝 Writing New Tests

### Test File Template
```python
"""
Description of test module.
"""
import pytest
from fastapi.testclient import TestClient


class TestYourFeature:
    """Test your feature."""

    def test_something(self, client: TestClient):
        """Test something specific."""
        response = client.get("/api/endpoint")
        assert response.status_code == 200
```

### Async Test Template
```python
@pytest.mark.asyncio
async def test_async_function():
    """Test async functionality."""
    result = await some_async_function()
    assert result is not None
```

### Using Fixtures
```python
def test_with_fixture(self, client: TestClient, sample_device: dict):
    """Test using predefined fixtures."""
    response = client.post("/api/devices", json=sample_device)
    assert response.status_code == 200
```

## 🐛 Common Issues

### Import Errors
If you get import errors, make sure you're running from the backend directory:
```bash
cd backend
pytest
```

### Async Test Errors
Make sure async tests are marked with `@pytest.mark.asyncio`:
```python
@pytest.mark.asyncio
async def test_async():
    pass
```

### Fixture Not Found
Check that fixture is defined in `conftest.py` or imported correctly.

## 📚 Testing Best Practices

1. **Test One Thing**: Each test should verify one specific behavior
2. **Clear Names**: Use descriptive test names (test_add_device_with_invalid_ip)
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Use Fixtures**: Reuse common setup with fixtures
5. **Test Edge Cases**: Invalid inputs, boundaries, error conditions
6. **Fast Tests**: Keep tests fast for rapid feedback

## 🔍 Coverage Goals

- **API Endpoints**: 90%+ coverage
- **Effect Engine**: 85%+ coverage
- **Custom Effects**: 85%+ coverage
- **Overall**: 80%+ coverage

## 📈 Future Test Additions

- [ ] WebSocket tests
- [ ] Performance tests
- [ ] Load tests
- [ ] Integration tests with real DMX hardware
- [ ] Frontend E2E tests with Playwright/Cypress

## 🤝 Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this README if adding new test categories
