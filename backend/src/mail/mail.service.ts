// mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;

    constructor(private config: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.config.get<string>('MAIL_HOST'),
            port: this.config.get<number>('MAIL_PORT'),
            auth: {
                user: this.config.get<string>('MAIL_USER'),
                pass: this.config.get<string>('MAIL_PASSWORD'),
            },
        });
    }

    async sendVerificationEmail(to: string, token: string): Promise<void> {
        const baseUrl = this.config.get<string>('APP_URL');
        const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`;

        await this.transporter.sendMail({
            from: '"Music Room" <noreply@musicroom.com>',
            to,
            subject: 'Verify your email',
            html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`,
        });
    }
}