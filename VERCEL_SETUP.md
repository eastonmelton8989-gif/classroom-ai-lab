# Vercel Setup

The Science Lab supports an optional self-hosted AI 3D worker.

Add this environment variable in Vercel:

```
TRIPOSR_ENDPOINT=https://your-worker-address/generate
```

Without it, the website stays online and uses demo mode.

With it, uploaded diagrams are sent to your AI worker and returned as GLB models.
