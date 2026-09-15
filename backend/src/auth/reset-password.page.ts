// page ouverte depuis le lien du mail de reset. html pur sans js : elle marche
// dans n'importe quel navigateur, y compris celui du telephone

// escape the html chars (No XSS with the token or the errors)
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// memes couleurs que mobile/src/config/theme.ts
function layout(body: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Music Room - Nouveau mot de passe</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
             padding: 24px 16px; background: #121212; color: #fff; font-family: system-ui, sans-serif; }
      main { width: 100%; max-width: 380px; }
      h1 { font-size: 22px; margin: 0 0 8px; text-align: center; }
      p { color: #B3B3B3; font-size: 14px; line-height: 1.5; text-align: center; margin: 0 0 24px; }
      label { display: block; font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
      input { width: 100%; padding: 12px 14px; font-size: 15px; color: #fff; background: #282828;
              border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; }
      input:focus { outline: none; border-color: #1DB954; }
      button { width: 100%; margin-top: 24px; padding: 14px; font-size: 15px; font-weight: 700;
               color: #000; background: #1DB954; border: 0; border-radius: 999px; cursor: pointer; }
      button:hover { background: #1ED760; }
      .errors { margin: 0 0 8px; padding: 12px 14px; list-style: none; font-size: 13px; color: #F87171;
                background: rgba(248,113,113,0.14); border-radius: 8px; }
      .errors li + li { margin-top: 4px; }
      .ok { color: #1DB954; }
      .ko { color: #F87171; }
    </style>
  </head>
  <body><main>${body}</main></body>
</html>`;
}

// render the new password form (with the errors on top if any)
export function renderResetForm(token: string, errors: string[] = []): string {
    const list = errors.length
        ? `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
        : '';
    return layout(`
      <h1>Nouveau mot de passe</h1>
      <p>12 caractères minimum, avec une majuscule, une minuscule, un chiffre et un caractère spécial.</p>
      ${list}
      <form method="post" action="/auth/reset-password/form">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <label for="newPassword">Nouveau mot de passe</label>
        <input id="newPassword" name="newPassword" type="password" autocomplete="new-password" required minlength="12">
        <label for="passwordConfirm">Confirmation</label>
        <input id="passwordConfirm" name="passwordConfirm" type="password" autocomplete="new-password" required minlength="12">
        <button type="submit">Changer le mot de passe</button>
      </form>`);
}

// render the success or expired link page
export function renderResetResult(success: boolean): string {
    return success
        ? layout(`
      <h1 class="ok">Mot de passe changé</h1>
      <p>Tu peux fermer cette page et te reconnecter dans l'app avec ton nouveau mot de passe.</p>`)
        : layout(`
      <h1 class="ko">Lien invalide ou expiré</h1>
      <p>Le lien ne sert qu'une fois et expire au bout de 15 minutes. Redemande-en un depuis l'écran « Mot de passe oublié » de l'app.</p>`);
}
