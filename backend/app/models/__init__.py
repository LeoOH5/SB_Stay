from app.models.base import TimestampMixin  # noqa: F401
from app.models.booking import (  # noqa: F401
    Booking,
    BookingItem,
    MealClaim,
    Message,
    Notification,
    Report,
    Review,
)
from app.models.content import AiPlan, AiUsage, Content, CourseSurvey, Package  # noqa: F401
from app.models.email_otp import EmailOtp  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.supply import (  # noqa: F401
    BuddyActivity,
    BuddyAvailability,
    BuddyProfile,
    DormRoom,
    Guide,
    Place,
    Tour,
    TourPlace,
    University,
    WalkRoute,
)
from app.models.user import User  # noqa: F401
