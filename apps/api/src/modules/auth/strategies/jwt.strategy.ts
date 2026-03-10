import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            isActive: true,
            blockedAt: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Check if company is active (unless super admin)
    if (user.company && (!user.company.isActive || user.company.blockedAt)) {
      return null;
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      roleId: user.role.id,
      roleName: user.role.name,
      companyId: user.companyId,
      companyName: user.company?.name || null,
      branchId: user.branchId,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.role.rolePermissions.map((rp) => rp.permission.code),
    };
  }
}
