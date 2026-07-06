from django.test import Client, override_settings


def test_ping_without_token_is_rejected():
    response = Client().get("/api/v1/ping/")
    assert response.status_code in (401, 403)


@override_settings(SERVICE_TOKEN="secret-abc")
def test_ping_with_valid_token():
    response = Client().get(
        "/api/v1/ping/", HTTP_AUTHORIZATION="ServiceToken secret-abc"
    )
    assert response.status_code == 200
    assert response.json() == {"pong": True}


@override_settings(SERVICE_TOKEN="secret-abc")
def test_ping_with_wrong_token_is_401():
    response = Client().get(
        "/api/v1/ping/", HTTP_AUTHORIZATION="ServiceToken nope"
    )
    assert response.status_code == 401


@override_settings(SERVICE_TOKEN="secret-abc")
def test_ping_accepts_x_service_token_header():
    response = Client().get("/api/v1/ping/", HTTP_X_SERVICE_TOKEN="secret-abc")
    assert response.status_code == 200
