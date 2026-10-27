<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Access API

The access feature is isolated in `src/access/`; the existing email/password
auth, bookmark, and user routes are unchanged. Citizen OTP sign-in sends and
verifies email codes through Supabase Auth. It also adds crew PIN login and
supervisor crew-PIN reset routes:

- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/crew/login`
- `GET /supervisor/crew-accounts` (field supervisor token required)
- `POST /supervisor/crew-accounts/:id/pin` (field supervisor token required)

Citizen OTP requests and verification use an email address:

```json
{ "email": "resident@example.com" }
```

Verification also requires the six-digit code sent by Supabase:

```json
{ "email": "resident@example.com", "code": "123456" }
```

Copy `.env.example` to `.env` as a reference, then supply a unique, strong
`JWT_SECRET`, `DATABASE_URL`, `SUPABASE_URL`, and Supabase key. Citizen OTP
sign-in uses Supabase Auth; enable email sign-in and configure the Supabase
email template to include `{{ .Token }}` so users receive the six-digit code
requested by `POST /auth/otp/request`. Configure Supabase Auth's rate limits
and CAPTCHA before exposing OTP requests publicly.

`JWT_SECRET` is also used by the existing auth feature, so changing it
invalidates existing JWTs. Do not use a placeholder or share a secret between
deployments. The Supabase service-role key is used only by the backend and must
never be exposed to a client. SMS remains in use for report status
notifications; configure the `SMS_*` settings if those notifications should
be delivered. Account phone numbers remain available for those notifications;
they are not used to sign in.

The access schema additions are in `prisma/schema.prisma`, with an additive
migration at `prisma/migrations/20261014120000_add_access_models`. Review and
apply it to the intended database using `npx prisma migrate deploy`, then
regenerate the Prisma client with `npx prisma generate`. The migration has not
been applied automatically.

The optional access test seed uses a known development PIN. It refuses to run
unless `ALLOW_ACCESS_TEST_SEED=true` is set and `NODE_ENV` is not production.
Never point it at a production database.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
