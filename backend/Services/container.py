from dataclasses import dataclass

from backend.config import Config
from backend.Infrastructure.stripe_client import StripeGateway
from backend.Services.checkout_service import CheckoutService
from backend.Services.payment_service import PaymentService
from backend.Services.ports import CatalogRepository, OrderRepository, PaymentGateway


@dataclass
class Services:
    """Wired services. Both are None until a SQL-backed repository exists; the checkout and
    payment endpoints then answer 503 NOT_CONFIGURED instead of pretending to work."""

    checkout: CheckoutService | None = None
    payments: PaymentService | None = None


def build_services(
    config: Config,
    catalog: CatalogRepository,
    orders: OrderRepository,
    gateway: PaymentGateway | None = None,
) -> Services:
    """Wire the services around real (or fake) repositories. Card payments are enabled only when
    both Stripe keys are configured or a gateway is injected."""
    if gateway is None and config.payments_enabled:
        gateway = StripeGateway(config.stripe_secret_key, config.stripe_webhook_secret)
    payments = PaymentService(gateway, orders) if gateway is not None else None
    return Services(checkout=CheckoutService(config, catalog, orders, payments), payments=payments)
