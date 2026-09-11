import { SetMetadata } from '@nestjs/common';

// sujet v.1 : un compte non verifie doit quand meme pouvoir se deconnecter et
// redemander un mail. ces routes se marquent pour passer le JwtAuthGuard
// sans etre bloquees par le controle emailisVerified
export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
