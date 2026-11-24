from dataclasses import dataclass

from backend.config import Config
from backend.Infrastructure.google_oauth import GoogleTokenVerifier
from backend.Infrastructure.stripe_client import StripeGateway
from backend.Services.account_service import AccountService
from backend.Services.admin_service import AdminService
from backend.Services.auth_service import AuthService
from backend.Services.checkout_service import CheckoutService
from backend.Services.payment_service import PaymentService
from backend.Services.ports import (
    CatalogRepository,
    GoogleVerifier,
    OrderRepository,
    PaymentGateway,
    UserRepository,
)
from backend.Services.public_service import PublicService


@dataclass
class Services:
    """Wired services. Both are None until a SQL-backed repository exists; the checkout and
    payment endpoints then answer 503 NOT_CONFIGURED instead of pretending to work."""

    checkout: CheckoutService | None = None
    payments: PaymentService | None = None
    auth: AuthService | None = None
    admin: AdminService | None = None
    public: PublicService | None = None
    account: AccountService | None = None


def build_services(
    config: Config,
    catalog: CatalogRepository,
    orders: OrderRepository,
    gateway: PaymentGateway | None = None,
    users: UserRepository | None = None,
    google: GoogleVerifier | None = None,
) -> Services:
    """Wire the services around real (or fake) repositories. Card payments are enabled only when
    both Stripe keys are configured or a gateway is injected."""
    if gateway is None and config.payments_enabled:
        gateway = StripeGateway(config.stripe_secret_key, config.stripe_webhook_secret)
    payments = PaymentService(gateway, orders) if gateway is not None else None
    if google is None and config.google_client_id:
        google = GoogleTokenVerifier(config.google_client_id)
    auth = AuthService(google, users) if users is not None and google is not None else None
    return Services(
        checkout=CheckoutService(config, catalog, orders, payments), payments=payments, auth=auth
    )


def build_sql_services(config: Config) -> Services:
    """Wire the services over the SQL repositories (used by app.py when the database is set up)."""
    from backend.Infrastructure.blob_storage import BlobStorage
    from backend.Infrastructure.sql_public import SqlPublicRepository
    from backend.Infrastructure.sql_repositories import (
        SqlAccountRepository,
        SqlCatalogRepository,
        SqlOrderRepository,
    )

    orders = SqlOrderRepository()
    services = build_services(config, SqlCatalogRepository(), orders, users=SqlAccountRepository())
    repo = SqlPublicRepository()
    services.admin = AdminService(repo, orders, services.payments, BlobStorage.from_env())
    services.public = PublicService(repo, config, payments_enabled=services.payments is not None)
    services.account = AccountService(SqlAccountRepository())
    return services
