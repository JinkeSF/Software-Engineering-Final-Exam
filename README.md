## Database Design (ER Model)

```mermaid
erDiagram
    REGION ||--|{ SUBREGION : contains
    SUBREGION ||--|{ COUNTRY : contains
    COUNTRY ||--|{ FERTILITY_RECORD : has

    REGION {
        int id PK
        string name
    }

    SUBREGION {
        int id PK
        string name
        int region_id FK
    }

    COUNTRY {
        string alpha_3_code PK
        string name
        string alpha_2_code
        int sub_region_id FK
    }

    FERTILITY_RECORD {
        int id PK
        string country_code FK
        int year
        decimal tfr
    }