# Install Antigravity (latest)

## Two separate products

- **Antigravity** — the AI product
- **Antigravity IDE** — the IDE

They are downloaded and installed separately.

## Download and run

1. Download the two latest `.tar` files from https://antigravity.google/releases
2. Extract each one into its own folder.
3. From the extracted folder, run:

```bash
./antigravity --no-sandbox      # Antigravity (AI)
./antigravity-ide --no-sandbox  # Antigravity IDE
```

The `--no-sandbox` flag is required.

## Add to the applications menu

1. Create an installation folder (e.g. `~/Installations`) and copy the Antigravity IDE folder into it.
2. Right-click the round icon at the bottom-left > **Edit Application**.
3. Go to **Development** > **New** > name it `Antigravity IDE`.
4. For the command, browse to the executable:

```
/home/sushant/Installations/Antigravity IDE/antigravity-ide
```

5. Set **Command-line arguments** to `--no-sandbox`.
6. Repeat the same steps for Antigravity (AI) if you want it in the menu too.

## Set the icon

- In the same edit dialog: **Generic Name** > **Edit** > **Other** > **Browse**
- Navigate to the installation folder > `Resources` and pick the Antigravity icon.
    
