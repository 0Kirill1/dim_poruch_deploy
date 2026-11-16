package dimporuchbe.security.config;

public interface TokenRevocationService {
    boolean isTokenRevoked(String token);
}
