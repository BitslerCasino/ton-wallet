import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class APIAuthenticationGuard implements CanActivate {
  private readonly logger = new Logger(APIAuthenticationGuard.name);

  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (req.route.path === '/') return true;
    const { authorization = null } = req.headers;
    if (authorization === null) {
      this.logger.warn('Authentication KO: missing Authorization header');
      return false;
    }
    const apiKey = authorization.split(' ')[1] || null;
    if (apiKey === null || apiKey?.length === 0) {
      this.logger.warn('Authentication KO: invalid Authorization header');
      return false;
    }

    const authResult = this.authService.validateApiKey(apiKey);
    if (authResult.success === false) {
      this.logger.warn('Authentication KO');
      return false;
    }

    this.logger.debug(`Authentication OK for: ${authResult.appname}`);

    return true;
  }
}
