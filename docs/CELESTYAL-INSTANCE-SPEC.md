# Talia instance for Celestyal — provisioning specification

**Audience:** Celestyal, to provision Azure.  
**Prepared:** 28 October 2026.  
**Scope:** One new Azure virtual machine, owned by Celestyal, running the Talia application stack and a copy of the current Talia database. This is a new instance. It does not replace Azure Synapse.

## 1. What this instance is

Talia is the revenue and inventory workspace. On this machine it is a single Docker Compose stack:

- Web application (React)
- GraphQL API
- RM agent runtime (talia-engine)
- Self-hosted Supabase: Postgres 15, Auth, API gateway, REST, Realtime, Storage, and Studio

The database is a serving copy synced one way from the existing Celestyal Synapse dedicated SQL pool. Synapse remains the warehouse. Talia does not replace it.

Measured on 28 October 2026, the database to copy is **2.0 GB**. The commercial window already loaded is multi-year: reservations, published rates, occupancy, and competitor rows run from September 2025 departures through late 2028. Book targets run through March 2029. The largest tables are competitor (481 MB), reservation promotions (330 MB), commercial book targets (283 MB), and port-city reference data (227 MB).

## 2. Size to provision

Provision this on day one. It covers the current database and twelve months of growth at the present grain.

| Resource | Specification |
|---|---|
| Region | The same Azure region as dedicated SQL pool `CDP_Dedicated_SQL_DWH` |
| Virtual machine | `Standard_D4s_v5` — 4 vCPU, 16 GiB RAM |
| Operating system | Ubuntu 22.04 LTS Gen2 |
| OS disk | 128 GiB Premium SSD (P10) |
| Data disk | 128 GiB Premium SSD (P10), separate from the OS disk |
| Public IP | Standard, static |
| Network | New resource group, VNet, subnet, and network security group, owned by Celestyal |

`Standard_D4s_v5` has no local temporary disk. Postgres and Docker volumes go on the 128 GiB data disk.

**Why this size.** The working set today is 2.0 GB, so 16 GiB RAM holds the database in memory and still leaves room for the API, the agent runtime, and the Supabase services. Four vCPUs serve an internal workspace of concurrent revenue and commercial users, plus a scheduled Synapse sync.

**Twelve-month envelope.** Extending the departure horizon by one year, and keeping published-rate change history for 18 months, takes the database to about **4–6 GB**. The 128 GiB data disk holds that database, a second copy during restore, and a local dump. Reference data (ports, agencies) grows slowly.

**Resize trigger, not a day-one purchase.** Move to `Standard_D8s_v5` (8 vCPU, 32 GiB) and a 256 GiB data disk only if the database passes 12 GB, or if the daily Synapse sync and daytime use contend for CPU. No GPU. This is not a Kubernetes cluster and not Azure Database for PostgreSQL: the application is the existing Supabase Docker stack.

## 3. Network

| Direction | Rule |
|---|---|
| Inbound TCP 443 | Celestyal corporate egress ranges, or a named user allow-list. HTTPS only. |
| Inbound TCP 22 | Celestyal administrator addresses only. Password login disabled. |
| Inbound 80 | Open only if needed for certificate issuance, then close or redirect to 443. |
| Outbound TCP 1433 | The existing Synapse dedicated SQL pool, so Talia can sync. |
| Outbound HTTPS | Docker image pulls and certificate renewal. |

Admin access is an SSH key held by Celestyal. A VPN or Azure Bastion may replace the public SSH rule. The application is not published through a laptop tunnel.

Celestyal supplies the DNS name (A record to the static IP) and the TLS certificate, or agrees that the host obtains a public certificate for that name.

## 4. Identity and secrets

Celestyal owns the resource group, the VM, the disks, and the keys.

Provide at provisioning:

1. Azure region of `CDP_Dedicated_SQL_DWH`.
2. Resource group name and subscription.
3. SSH public key and the admin username (the Azure default `azureuser` is fine).
4. Hostname for the workspace.
5. Source IP ranges for HTTPS and SSH.
6. A new read-only SQL login on the Synapse dedicated SQL pool, for the objects Talia already syncs. Store the password in Azure Key Vault. Do not reuse a personal developer login.
7. A named owner for the VM and for the Synapse login.

Application secrets (Postgres password, Supabase JWT keys) are generated for this instance at install. They are not copied from the developer environment. The database restore brings data, not those secrets.

## 5. Backup

| Item | Specification |
|---|---|
| Storage account | Same region, LRS, cool tier, private to this resource group |
| Capacity | 50 GB is sufficient for a year of compressed dumps |
| Database | Nightly `pg_dump` of Postgres to that storage account, retained 30 days |
| Virtual machine | Azure Backup, daily, retained 30 days |
| Rate-change history | Keep `published_rates_changes` for 18 months, then delete older rows. That table is the one that can grow without a matching business window. |

A restore of the 2 GB database onto this host is part of handover, and one restore test is repeated after the first nightly dump.

## 6. What is installed after the VM exists

Celestyal provisions the resources in sections 2–5. Deployment onto that VM then:

- Installs Docker and the Talia Compose stack (UI, GraphQL API, talia-engine, Supabase).
- Restores the current 2.0 GB database.
- Points sync at the Celestyal Synapse login.
- Serves the workspace on the Celestyal hostname over HTTPS.

## 7. Handover checklist

- [ ] Resource group in the Synapse region
- [ ] `Standard_D4s_v5`, Ubuntu 22.04 LTS
- [ ] OS disk 128 GiB P10, data disk 128 GiB P10
- [ ] Static public IP and DNS name
- [ ] NSG: 443 and 22 restricted, 1433 outbound to Synapse
- [ ] SSH key, Key Vault, read-only Synapse login
- [ ] Storage account for dumps, VM backup policy
- [ ] Named Celestyal owner
