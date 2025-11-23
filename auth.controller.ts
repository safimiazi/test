import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Request,
  Put,
  UnauthorizedException,
  Req,
  Query,
  Res,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiBody, ApiCookieAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from '../activities/activities.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { ACGuard, UseRoles } from 'nest-access-control';
import { LocalAuthGuard } from './guards/local-auth.guard';

import {
  AdminLoginExample,
  LoginExample,
  RequestPasswordExample,
  SignUpExample,
  UpdatePasswordExample,
  VerifyTokenExample,
} from './auth.example';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { BrowserIdDto } from './dto/browser-id-dto';
import { ConfigService } from '../config/config.service';
import {
  getAuthTokenName,
  getCookieObject,
  getGuestCookieObject,
  getRefreshCookieObject,
  getRefreshTokenName,
} from 'src/utils/auth';
import { Role } from 'src/common/enums';
import { UserTransformer } from '../users/user.transformer';
import { BooksService } from '../books/books.service';
import { StripeService } from '../subscriptions/stripe.service';

@ApiTags('Auth')
@Controller('/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly activityService: ActivitiesService,
    private readonly configService: ConfigService,
    private readonly booksService: BooksService,
    private readonly stripeService: StripeService,
  ) {}

  private getTodayEnd() {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 0, 0);
    return endOfDay;
  }

  /**
   * Signup route to create new users
   * @param {CreateUserDto} payload the CreateUserDto dto
   */
  @ApiResponse({ status: 200, description: 'Signup Completed' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @Post('/signup')
  @ApiBody(SignUpExample)
  async signUp(
    @Req() req,
    @Body() body: CreateUserDto,
    @Res() reply: FastifyReply,
  ) {
    const data = await this.authService.signUp(body);
    if (body.skipEmailVerification) {
      const isProd = this.configService.get('IS_PROD') === 'true';
      const isLocal = this.configService.get('NODE_ENV') !== 'production';
      const tokenName = getAuthTokenName(isProd);
      const refreshTokenName = getRefreshTokenName(isProd);
      const endOfDay = this.getTodayEnd();
      if (data.user) {
        try {
          await this.booksService.copyGuestBooks(
            req.cookies?.['rl-browser-id'],
            data.user.id,
            true,
          );
        } catch (e) {
          console.log('error while copy book', e);
        }
      }
      return reply
        .setCookie(tokenName, data?.access_token, {
          ...getCookieObject(isLocal),
          expires: endOfDay,
        })
        .setCookie(refreshTokenName, data.refresh_token, {
          ...getRefreshCookieObject(isLocal),
          maxAge: 30 * 24 * 60 * 60,
        })
        .send({
          ...data,
          user: {
            ...data.user,
            exp: endOfDay,
          },
        });
    }
    reply.send({ message: 'An Email sent to your account please verify' });
  }

  /**
   * Account verify route to create new users
   */
  @ApiResponse({ status: 200, description: 'Signup Completed' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiBody(VerifyTokenExample)
  @Post('verify')
  async verify(
    @Req() req: any,
    @Body() body: VerifyTokenDto,
    @Res() reply: FastifyReply,
  ) {
    const data = await this.authService.verify(body);
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';
    const tokenName = getAuthTokenName(isProd);
    const refreshTokenName = getRefreshTokenName(isProd);
    const endOfDay = this.getTodayEnd();
    if (data.user) {
      try {
        await this.booksService.copyGuestBooks(
          req.cookies?.['rl-browser-id'],
          data.user.id,
        );
      } catch (e) {
        console.log('error while copy book', e);
      }
    }
    return reply
      .setCookie(tokenName, data?.access_token, {
        ...getCookieObject(isLocal),
        expires: endOfDay,
      })
      .setCookie(refreshTokenName, data.refresh_token, {
        ...getRefreshCookieObject(isLocal),
        maxAge: 30 * 24 * 60 * 60,
      })
      .send({
        ...data,
        user: {
          ...data.user,
          exp: endOfDay,
        },
      });
  }

  /**
   * Login route to validate and create tokens for users
   * @param {LoginPayload} payload the login dto
   */
  @ApiResponse({ status: 200, description: 'Login Completed' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody(LoginExample)
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  async login(@Req() req, @Res() reply: FastifyReply) {
    if (req.query.role && !req.user.roles.includes(req.query.role)) {
      throw new UnauthorizedException();
    }
    let loginData: any = {};
    const data = await this.authService.login(req.user);
    await this.activityService.loginActivity(req.user._id, req.userIp);
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';

    const guestTokenName = getAuthTokenName(isProd);
    reply.clearCookie(guestTokenName, getGuestCookieObject(isLocal));
    const tokenName = getAuthTokenName(isProd);
    const refreshTokenName = getRefreshTokenName(isProd);
    const endOfDay = this.getTodayEnd();
    loginData = {
      ...data,
      user: {
        ...data.user,
        exp: endOfDay,
      },
    };
    reply
      .setCookie(tokenName, data.access_token, {
        ...getCookieObject(isLocal),
        expires: endOfDay,
      })
      .setCookie(refreshTokenName, data.refresh_token, {
        ...getRefreshCookieObject(isLocal),
        maxAge: 30 * 24 * 60 * 60,
      })
      .send(loginData);
  }

  @Post('/refresh')
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async refresh(@Req() req, @Res() reply: FastifyReply) {
    const isProd = this.configService.get('IS_PROD') === 'true';
    const refreshTokenName = getRefreshTokenName(isProd);
    const refreshToken = req.cookies?.[refreshTokenName];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    if (tokens) {
      await this.activityService.loginActivity(
        tokens.user.id.toString(),
        req.userIp,
      );
    }
    const isLocal = this.configService.get('NODE_ENV') !== 'production';
    const tokenName = getAuthTokenName(isProd);
    const endOfDay = this.getTodayEnd();
    reply
      .setCookie(tokenName, tokens.access_token, {
        ...getCookieObject(isLocal),
        expires: endOfDay,
      })
      .setCookie(refreshTokenName, tokens.refresh_token, {
        ...getRefreshCookieObject(isLocal),
        maxAge: 30 * 24 * 60 * 60,
      })
      .send({ success: true });
  }

  /**
   * it enables admins to log in as any user
   * @param req Request object
   * @param body AdminLoginDto
   * @returns
   */
  @ApiResponse({ status: 200, description: 'Login Completed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseGuards(JwtAuthGuard, ACGuard)
  @Post('/admin-login')
  @UseRoles({
    resource: 'admin-login',
    action: 'create',
    possession: 'any',
  })
  @HttpCode(HttpStatus.OK)
  @ApiBody(AdminLoginExample)
  @ApiCookieAuth()
  async adminLogin(
    @Request() req,
    @Body() body: AdminLoginDto,
    @Res() reply: FastifyReply,
  ) {
    const user = await this.usersService.findById(body.id);
    await this.activityService.addActivity(
      'AdminLogin',
      'authentication',
      req.user.id,
      req.userIp,
      {
        userId: body.id,
      },
    );
    const data = await this.authService.login(user, req.user.id.toString());
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';
    const tokenName = getAuthTokenName(isProd);
    const refreshTokenName = getRefreshTokenName(isProd);
    const endOfDay = this.getTodayEnd();
    return reply
      .setCookie(tokenName, data?.access_token, {
        ...getCookieObject(isLocal),
        expires: endOfDay,
      })
      .setCookie(refreshTokenName, data.refresh_token, {
        ...getRefreshCookieObject(isLocal),
        maxAge: 30 * 24 * 60 * 60,
      })
      .send({
        ...data,
        user: {
          ...data.user,
          exp: endOfDay,
        },
      });
  }

  /**
   * Guest token generator route
   */
  @ApiResponse({ status: 200, description: 'Guest token generated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @Post('/guest')
  async guest(
    @Request() req,
    @Query() query: BrowserIdDto,
    @Res() reply: FastifyReply,
  ) {
    const data = await this.authService.guestToken(
      req.raw.userIp,
      query.browserId,
    );
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';
    const tokenName = getAuthTokenName(isProd);
    return reply
      .setCookie(tokenName, data?.access_token, getGuestCookieObject(isLocal))
      .send(data);
  }

  @Post('/convert-ip')
  @HttpCode(HttpStatus.OK)
  async convert(@Request() req, @Res() reply: FastifyReply) {
    const data = await this.authService.guestToken(req.body.ip);
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';
    const tokenName = getAuthTokenName(isProd);
    return reply
      .setCookie(tokenName, data?.access_token, getCookieObject(isLocal))
      .send(data);
  }

  @Get('/me')
  async me(@Request() req, @Res() reply: FastifyReply) {
    const endOfDay = this.getTodayEnd();
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';
    const tokenName = getAuthTokenName(isProd);
    const refreshTokenName = getRefreshTokenName(isProd);
    const clearOptions = {
      ...getCookieObject(isLocal),
      expires: new Date(0),
    };
    const authToken = req.cookies?.[tokenName];
    const browserId = req.cookies?.['rl-browser-id'];
    let data: any = {};
    try {
      if (authToken) {
        data = await this.authService.getTokenData(authToken);

        if (data.roles[0] != Role.Guest) {
          const user = await this.usersService.findById(data.id);
          if (!user) {
            throw new UnauthorizedException();
          }
          data = {
            ...data,
            ...UserTransformer(user),
          };
          const sub = await this.authService.getSubscriptionByUserId({
            user: data.id,
            isActive: true,
          });
          if (sub) {
            data.plan = sub.planName;
          } else {
            data.plan = 'free';
          }

          const remainingChars = await this.authService.getUsageLimit(
            data.id,
            sub ? sub?.plan?.limit?.msgPerDay : 5,
            sub ? sub?.plan?.limit?.summaryLimit : 3,
            sub ? sub.planName : "free"

          );
          data.limits = {
            char: remainingChars.remainingChars,
            msg: remainingChars.remainingMessage,
            summary: remainingChars.remainingSummary
          };

          data.exp = endOfDay;
          return reply.send(data);
        }
      }
    } catch (error) {
      console.log('error on me endpoint', error);
      return reply
        .clearCookie(tokenName, clearOptions)
        .clearCookie(refreshTokenName, clearOptions)
        .status(HttpStatus.UNAUTHORIZED)
        .send({ message: 'Unauthorized' });
    }

    const gtoken = await this.authService.guestToken(req.raw.userIp, browserId);

    const guestData = {
      id: gtoken?.browserId,
      roles: ['guest'],
      plan: 'free',
      exp: endOfDay,
    };

    return reply
      .setCookie(tokenName, gtoken.access_token, getGuestCookieObject(isLocal))
      .setCookie(
        'rl-browser-id',
        gtoken.browserId,
        getGuestCookieObject(isLocal, 365),
      )
      .clearCookie(refreshTokenName, clearOptions)
      .send(guestData);
  }

  // TODO, optimse, create dto
  @Post('/request-password')
  @UseGuards(JwtAuthGuard, ACGuard)
  @UseRoles({
    resource: 'request-password',
    action: 'create',
    possession: 'any',
  })
  @ApiResponse({
    status: 200,
    description: 'Reset link is sent to your registered email.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @HttpCode(HttpStatus.OK)
  @ApiBody(RequestPasswordExample)
  async requestPassword(@Request() req) {
    const userData = req.body;
    await this.authService.requestPassword(userData);
    return { message: 'Reset link is sent to your registered email.' };
  }

  @Post('/update-password')
  @UseGuards(JwtAuthGuard, ACGuard)
  @UseRoles({
    resource: 'update-password',
    action: 'create',
    possession: 'any',
  })
  @ApiResponse({ status: 200, description: 'Reset Completed' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @ApiResponse({ status: 410, description: 'Link Expired' })
  @ApiBody(UpdatePasswordExample)
  async resetPassword(@Body() body: ResetPasswordDto) {
    const data = await this.authService.resetPassword(body);
    return { message: data };
  }

  @Post('/social/google')
  async socialLogin(@Request() req, @Res() reply: FastifyReply) {
    const userData = req.body;
    const data = await this.authService.socialLogin(
      req.cookies?.['rl-browser-id'],
      userData,
      req.query.type == 'paid',
    );
    const userId = data.user.id.toString();
    if (!data.isNew) {
      await this.activityService.loginActivity(userId, req.userIp);
    }
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';

    const guestTokenName = getAuthTokenName(isProd);
    reply.clearCookie(guestTokenName, getGuestCookieObject(isLocal));

    const tokenName = getAuthTokenName(isProd);
    const refreshTokenName = getRefreshTokenName(isProd);
    const endOfDay = this.getTodayEnd();
    return reply
      .setCookie(tokenName, data?.access_token, {
        ...getCookieObject(isLocal),
        expires: endOfDay,
      })
      .setCookie(refreshTokenName, data.refresh_token, {
        ...getRefreshCookieObject(isLocal),
        maxAge: 30 * 24 * 60 * 60,
      })
      .send({
        ...data,
        user: {
          ...data.user,
          exp: endOfDay,
        },
      });
  }

  @UseGuards(JwtAuthGuard, ACGuard)
  @UseRoles({
    resource: 'user-status',
    action: 'update',
    possession: 'any',
  })
  @Put('/update-user-status')
  async updateUserStatus(@Request() req) {
    const userId = req.user.id;
    await this.authService.updateUserStatus(userId);
    return { message: 'Status updated successfully' };
  }

  // TODO, optimse, create dto
  @Post('/resend-account-verification')
  async resendAccountVerification(@Request() req) {
    await this.authService.resendAccountVerification(req.body);
    return { message: 'An Email sent to your account please verify' };
  }

  @ApiResponse({ status: 200, description: 'Logout Completed' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Something Went Wrong' })
  @Post('/logout')
  async logout(@Req() req, @Res() reply: FastifyReply) {
    const isProd = this.configService.get('IS_PROD') === 'true';
    const isLocal = this.configService.get('NODE_ENV') !== 'production';
    const tokenName = getAuthTokenName(isProd);
    const refreshTokenName = getRefreshTokenName(isProd);
    const clearOptions = {
      ...getCookieObject(isLocal),
      expires: new Date(0),
    };
    const refreshToken = req.cookies?.[refreshTokenName];

    if (refreshToken) {
      try {
        const tokenData = await this.authService.getTokenData(refreshToken);
        await this.authService.removeRefreshToken(tokenData.id, refreshToken);
      } catch (e) {
        console.error('Error removing refresh token:', e);
      }
    }

    return reply
      .clearCookie(tokenName, clearOptions)
      .clearCookie(refreshTokenName, clearOptions)
      .send({ message: 'Logout successful' });
  }
}
