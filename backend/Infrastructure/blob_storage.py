"""Product image storage in Azure Blob Storage. Only the public URL is saved in the database."""

import os
import uuid

from backend.errors import AppError

CONTENT_TYPES = {"image/png": "png", "image/jpeg": "jpg"}


class BlobStorage:
    def __init__(self, connection_string: str, container: str):
        self._connection_string = connection_string
        self._container = container

    @classmethod
    def from_env(cls) -> "BlobStorage | None":
        connection = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
        if not connection:
            return None
        return cls(connection, os.getenv("AZURE_STORAGE_CONTAINER", "product-images").strip())

    def upload_image(self, product_id: int, data: bytes, content_type: str) -> str:
        """Store the image and return its URL. The name is unique so old URLs keep working."""
        from azure.storage.blob import ContentSettings, BlobServiceClient  # lazy: optional dep

        extension = CONTENT_TYPES[content_type]
        name = f"products/{product_id}-{uuid.uuid4().hex[:10]}.{extension}"
        try:
            service = BlobServiceClient.from_connection_string(self._connection_string)
            blob = service.get_blob_client(container=self._container, blob=name)
            blob.upload_blob(data, content_settings=ContentSettings(content_type=content_type))
        except Exception as exc:  # network/credentials: report, never leak details to the client
            raise AppError(
                "The image could not be stored.", error_code="STORAGE_UNAVAILABLE", http_status=502
            ) from exc
        return blob.url
