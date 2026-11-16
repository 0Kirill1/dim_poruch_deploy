package dimporuchbe.user.application;

import dimporuchbe.user.persistence.TokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TokenHousekeepingService {
    private final TokenRepository tokenRepository;

    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanupTokens() {
        tokenRepository.deleteAllRevokedOrExpiredTokens();
    }
}
