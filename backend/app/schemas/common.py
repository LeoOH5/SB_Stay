from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ListResponse[T](BaseModel):
    items: list[T]
    next_cursor: str | None = None


class ErrorBody(BaseModel):
    code: str
    message: str
