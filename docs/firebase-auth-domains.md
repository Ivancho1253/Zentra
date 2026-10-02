# Firebase Auth Domains

Firebase Auth blocks sign-in from domains that are not explicitly authorized.

## Where To Add Domains

Firebase Console:

```text
Authentication > Settings > Authorized domains
```

Add hostnames only. Do not include `https://`, `http://`, paths, or ports.

## Local Development

Add:

```text
localhost
127.0.0.1
```

If you open the app at `http://localhost:3000`, Firebase checks `localhost`.

If you open the app at `http://127.0.0.1:3000`, Firebase checks `127.0.0.1`.

## Render Beta

Add your Render service hostname, for example:

```text
zentra-beta.onrender.com
```

Use the exact hostname from your deployed URL.

If your Render URL is:

```text
https://zentra-beta.onrender.com
```

The Firebase authorized domain should be:

```text
zentra-beta.onrender.com
```

## Custom Domain

If later you use a custom domain, also add:

```text
zentra.yourdomain.com
```

## Provider Checklist

Firebase Console:

```text
Authentication > Sign-in method
```

Enable every provider the UI exposes:

- Email/Password
- Google

## Common Error

`auth/unauthorized-domain` means the current hostname is missing from Authorized domains.
