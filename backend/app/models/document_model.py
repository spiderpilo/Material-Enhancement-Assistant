from pydantic import BaseModel, ConfigDict


class CourseContentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    material_name: str
    access_url: str
    data_size: int
