import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
    private transporter: nodemailer.Transporter;
    // l'expediteur doit etre un email verifie chez le provider SMTP (Brevo par
    // exemple droppe silencieusement les mails envoyes depuis un domaine sans
    // SPF/DKIM) : configurable plutot que code en dur.
    private from: string;
    // Ethereal ne delivre jamais reellement : chaque envoi renvoie un lien de
    // previsualisation a la place. Utile pour demontrer la fonctionnalite sans
    // dependre de la reputation d'un vrai provider.
    private isEthereal = false;
    private readonly logger = new Logger(MailService.name);

    constructor(private config: ConfigService) {}

    async onModuleInit(): Promise<void> {
        const host = this.config.get<string>('MAIL_HOST');
        this.isEthereal = !host || host === 'ethereal';

        if (this.isEthereal) {
            // Identifiants fixes s'ils sont fournis (.env), sinon un compte
            // jetable est genere : sans MAIL_USER/PASSWORD, une nouvelle boite
            // Ethereal apparaitrait a chaque redemarrage, invisible pour qui
            // veut se connecter directement sur ethereal.email et consulter
            // ses mails sans repasser par les logs backend.
            const fixedUser = this.config.get<string>('MAIL_USER');
            const fixedPass = this.config.get<string>('MAIL_PASSWORD');
            const account = fixedUser && fixedPass ? { user: fixedUser, pass: fixedPass } : await nodemailer.createTestAccount();

            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: { user: account.user, pass: account.pass },
            });
            this.from = '"Music Room" <noreply@musicroom.test>';
            this.logger.log(`Mail: Ethereal actif — boite ${account.user} (se connecter sur https://ethereal.email/login)`);
            return;
        }

        this.transporter = nodemailer.createTransport({
            host,
            port: this.config.get<number>('MAIL_PORT'),
            auth: {
                user: this.config.get<string>('MAIL_USER'),
                pass: this.config.get<string>('MAIL_PASSWORD'),
            },
        });
        this.from = `"Music Room" <${this.config.get<string>('MAIL_FROM')}>`;
    }

    // sendMail() qui reussit veut juste dire "accepte pour relais" : ca ne
    // prouve pas la livraison. On loggue la reponse SMTP complete
    // (accepted/rejected/messageId) pour pouvoir diagnostiquer un mail
    // "envoye" mais jamais recu, sans avoir a rejouer manuellement. Sur
    // Ethereal, on loggue en plus le lien de previsualisation.
    private async send(to: string, subject: string, html: string): Promise<void> {
        const info = await this.transporter.sendMail({ from: this.from, to, subject, html });
        if (this.isEthereal) {
            this.logger.log(`Mail "${subject}" -> ${to} : previsualisation ${nodemailer.getTestMessageUrl(info)}`);
            return;
        }
        this.logger.log(
            `Mail "${subject}" -> ${to} : messageId=${info.messageId} accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} response=${info.response}`,
        );
    }

    async sendVerificationEmail(to: string, token: string): Promise<void> {
        const baseUrl = this.config.get<string>('APP_URL');
        const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;
        await this.send(to, 'Verify your email', `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`);
    }

    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        const baseUrl = this.config.get<string>('APP_URL');
        const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
        await this.send(
            to,
            'Reset your password',
            `
            <h2>Reset your Music Room password</h2>
            <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
            <a href="${resetUrl}">Reset my password</a>
            <p>If you didn't request this, ignore this email.</p>
        `,
        );
    }

    async sendSubscriptionConfirmedEmail(to: string): Promise<void> {
        await this.send(
            to,
            'Your Music Room Premium subscription is active',
            `
            <h2>Welcome to Music Room Premium</h2>
            <p>Your subscription is now active. You can create and manage Track Vote events.</p>
        `,
        );
    }

    async sendSubscriptionCancelledEmail(to: string): Promise<void> {
        await this.send(
            to,
            'Your Music Room Premium subscription was cancelled',
            `
            <h2>Subscription cancelled</h2>
            <p>Your Premium subscription has been cancelled. You can still join and vote in Track Vote events, but creating and managing new ones now requires Premium.</p>
        `,
        );
    }
}
