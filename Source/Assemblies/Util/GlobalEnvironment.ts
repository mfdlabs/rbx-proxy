import { Convert } from './Convert';
import { DotENV } from './DotENV';

export class GlobalEnvironment {
	public static get PersistLocalLogs(): bool {
		DotENV.GlobalConfigure();
		return Convert.ToBoolean(process.env.LOG_PERSIST, false);
	}

	public static get HateLANAccess(): bool {
		DotENV.GlobalConfigure();
		return Convert.ToBoolean(process.env.HATE_LAN_ACCESS, false);
	}

	public static get ShouldCheckCrawler(): bool {
		DotENV.GlobalConfigure();
		return Convert.ToBoolean(process.env.SHOULD_CHECK_CRAWLER, true);
	}

	public static get ShouldCheckIP(): bool {
		DotENV.GlobalConfigure();
		return Convert.ToBoolean(process.env.SHOULD_CHECK_IP, true);
	}

	public static get AllowedIPv4Cidrs(): string[] {
		DotENV.GlobalConfigure();
		return process.env.ALLOWED_IPV4_CIDRS?.split(',') ?? [];
	}

	public static get AllowedIPv6Cidrs(): string[] {
		DotENV.GlobalConfigure();
		return process.env.ALLOWED_IPV6_CIDRS?.split(',') ?? [];
	}

	public static get AbortConnectionIfCrawler(): bool {
		DotENV.GlobalConfigure();
		return Convert.ToBoolean(process.env.ABORT_CONNECTION_IF_CRAWLER, false);
	}

	public static get AbortConnectionIfInvalidIP(): bool {
		DotENV.GlobalConfigure();
		return Convert.ToBoolean(process.env.ABORT_CONNECTION_IF_INVALID_IP, false);
	}
}
