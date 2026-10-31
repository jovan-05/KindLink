"""The three one-click example causes shown on the landing page."""
from .agent.context import PlanInput

EXAMPLES = [
    {
        "key": "austin",
        "id": "example-austin-senior-dogs",
        "title": "Senior-dog rescue",
        "city_label": "Austin, TX",
        "input": PlanInput(
            cause="Animal rescue shelter that rehomes senior dogs",
            city="Austin", guests=150, budget="modest", month="March",
            interests=["Marley & Me"],
        ),
    },
    {
        "key": "chicago",
        "id": "example-chicago-literacy",
        "title": "Children's literacy nonprofit",
        "city_label": "Chicago, IL",
        "input": PlanInput(
            cause="Children's literacy nonprofit that runs free reading programs and gives books to kids",
            city="Chicago", guests=120, budget="shoestring", month="May",
            interests=["Where the Wild Things Are"],
        ),
    },
    {
        "key": "nyc",
        "id": "example-nyc-youth-music",
        "title": "Free youth music school",
        "city_label": "New York, NY",
        "input": PlanInput(
            cause="Free after-school music school teaching instruments to young people",
            city="New York", guests=200, budget="generous", month="October",
            interests=["School of Rock"],
        ),
    },
]

SUPPORTED_CITIES = [
    "Austin", "Atlanta", "Boston", "Chicago", "Dallas", "Denver", "Houston", "Los Angeles", "Miami",
    "Minneapolis", "Nashville", "New Orleans", "New York", "Philadelphia", "Phoenix", "Portland",
    "San Diego", "San Francisco", "Seattle", "Washington",
]
