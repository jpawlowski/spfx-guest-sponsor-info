# Security Assessment

This document summarizes the security model and residual risk for the
Guest Sponsor Info deployment options.

## Guest Sponsor API approach (recommended)

- Managed Identity: no secrets stored anywhere.
- `User.Read.All` is an application permission: the guest user never holds it.
  The function returns only the calling user's own sponsors (OID from the
  EasyAuth-validated token).
- EasyAuth rejects unauthenticated requests before function code runs.
- CORS restricted to the tenant's SharePoint origin.
- Caller OID redacted in function logs; structured reason codes for failures.

Overall risk level: Low. Recommended for production.

## Site Collection App Catalog

The web part bundle is served from the guest landing page site itself.
Guests cannot list or modify apps in the Site Collection App Catalog. They can
only download the compiled bundle via their normal site read access.

The bundle contains no credentials, user data, or secrets. Environment-specific
values are public Microsoft URLs and tenant-specific IDs obtained at runtime
from `pageContext`.

## Related Architecture Notes

For broader design rationale and trade-off context, see
[architecture.md](architecture.md#security).

## Report a Security Issue

For responsible disclosure of potential vulnerabilities in this Solution,
contact [security@workoho.com](mailto:security@workoho.com).

For non-security privacy inquiries, use
[privacy@workoho.com](mailto:privacy@workoho.com).
