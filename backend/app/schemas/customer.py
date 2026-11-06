from pydantic import BaseModel, Field


class CustomerRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    phone: str = Field(pattern=r"^\d{10}$")
    pin: str = Field(pattern=r"^\d{6}$")
    address: str = Field(min_length=5)
    location: str | None = Field(default=None, max_length=500)


class CustomerProfileUpdateRequest(BaseModel):
    address: str = Field(min_length=5)
    location: str | None = Field(default=None, max_length=500)
