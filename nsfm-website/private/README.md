# /private — protected assets

Drop the paid product PDF here:

    private/nervous-system-field-manual.pdf

This directory is **never** served statically (only `/public` is). The PDF is
delivered exclusively through the token-gated route `/download/:token/file`.

The PDF is gitignored (`private/*.pdf`) — it must be placed on the server /
deployment environment directly, not committed to the repository.

The filename is configured via `PDF_FILENAME` in `.env`.
