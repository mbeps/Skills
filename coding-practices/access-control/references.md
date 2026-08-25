# References & Further Reading

## Standards & Formal Models

- **NIST RBAC project** (Ferraiolo & Kuhn 1992; ANSI INCITS 359-2004/2012): https://csrc.nist.gov/projects/role-based-access-control
- **NIST SP 800-162** — Guide to ABAC: https://csrc.nist.gov/pubs/sp/800/162/final
- Kuhn, Coyne & Weil (2010), *Adding Attributes to Role-Based Access Control* — the canonical hybrid RBAC+ABAC argument: https://www.computer.org/csdl/magazine/co/2010/02/mco2010020048/13rdux1YptA
- **RBAC (Wikipedia)** — core/hierarchical/constrained levels, role explosion: https://en.wikipedia.org/wiki/Role-based_access_control
- **ABAC (Wikipedia)** — S/A/R/E attributes, XACML PEP/PDP/PIP: https://en.wikipedia.org/wiki/Attribute-based_access_control
- **XACML** (OASIS policy language): https://en.wikipedia.org/wiki/XACML
- **NGAC** (NIST Next Generation Access Control): https://csrc.nist.gov/projects/next-generation-access-control

## ReBAC

- **ReBAC (Wikipedia)** — relationship-based access control: https://en.wikipedia.org/wiki/Relationship-based_access_control
- **Google Zanzibar paper** (*Zanzibar: Google's Consistent, Global Authorization System*): https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/
- **OpenFGA** — open-source Zanzibar-inspired engine: https://openfga.dev/

## Libraries (when not to hand-roll)

| Library                                                           | Model                                                        | Fit                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| [Casbin](https://casbin.org/)                                     | PERM metamodel: ACL, RBAC (with domains), ABAC in one engine | Multi-model, config-driven            |
| [Oso](https://www.osohq.com/)                                     | Policy-as-code embedded in app                               | Logic-heavy rules in host language    |
| [OpenFGA](https://openfga.dev/) / [SpiceDB](https://spicedb.com/) | ReBAC (Zanzibar)                                             | Relationship graphs, sharing at scale |
| [CASL](https://casl.js.org/)                                      | JS attribute/role rules                                      | Frontend+backend TS apps              |

## Video Source

- Web Dev Simplified, *How To Handle Permissions Like A Senior Dev*: https://youtu.be/5GG-VUvruzE — evolution from naive checks → RBAC → multi-tenant/resource-level → ABAC.

## Compliance Pointers

RBAC controls map to: NIST SP 800-53 AC-3(7), PCI DSS Requirement 7, HIPAA access controls, CIS Control 6.
