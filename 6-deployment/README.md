# 6. Deployment

| Folder | Contents |
|---|---|
| [azure](azure/) | Production on Azure Container Apps: Bicep templates (`infra/`) and one-time setup (`bootstrap.sh`) |
| [scripts](scripts/) | The old single-VM deploy and its pipeline diagram (reference only) |
| [user-manual](user-manual/) | How to use the site |

The pipeline itself is in [.github/workflows](../.github/workflows/), because GitHub only runs workflows from that folder.
