package dimporuchbe.user.application;

import dimporuchbe.security.config.JwtService;
import dimporuchbe.user.api.dtos.*;
import dimporuchbe.user.persistence.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock UserRepository users;
    @Mock TokenRepository tokens;
    @Mock PasswordEncoder encoder;
    @Mock JwtService jwt;
    @Mock AuthenticationManager manager;
    AuthService service;
    User user;

    @BeforeEach
    void setUp() {
        service = new AuthService(users, tokens, encoder, jwt, manager);
        user = User.builder().id(UUID.randomUUID()).email("u@example.com")
                .password("hash").role(Role.TENANT).status("ACTIVE").build();
    }

    @Test
    void registrationRejectsDuplicateEmail() {
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        RegisterRequestDto dto = RegisterRequestDto.builder().email(user.getEmail())
                .password("password").role(Role.TENANT).build();
        assertThatThrownBy(() -> service.registerUser(dto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT");
        verify(users, never()).save(any());
    }

    @Test
    void loginReturnsTokensAndStoresBothTokens() {
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(jwt.generateToken(user.getEmail(), "TENANT")).thenReturn("access");
        when(jwt.generateRefreshToken(user.getEmail(), "TENANT")).thenReturn("refresh");
        LoginResponseDto response = service.loginUser(new LoginRequestDto(user.getEmail(), "password"));
        assertThat(response.getJwt_token()).isEqualTo("access");
        assertThat(response.getRefresh_token()).isEqualTo("refresh");
        verify(tokens, times(2)).save(any(Token.class));
    }

    @Test
    void loginRejectsDisabledUser() {
        user.setStatus("DISABLED");
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> service.loginUser(new LoginRequestDto(user.getEmail(), "password")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode().value()).isEqualTo(403));
        verify(jwt, never()).generateToken(any(), any());
    }

    @Test
    void refreshRequiresValidStoredNonRevokedToken() {
        when(jwt.extractEmail("refresh")).thenReturn(user.getEmail());
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(jwt.isTokenValid("refresh", user.getEmail())).thenReturn(true);
        when(tokens.findByToken("refresh")).thenReturn(Optional.of(Token.builder()
                .token("refresh").user(user).build()));
        when(jwt.generateToken(user.getEmail(), "TENANT")).thenReturn("new-access");
        LoginResponseDto response = service.refreshToken(new RefreshTokenRequestDto("refresh"));
        assertThat(response.getJwt_token()).isEqualTo("new-access");
        verify(tokens).save(any(Token.class));

        when(jwt.isTokenValid("refresh", user.getEmail())).thenReturn(false);
        assertThatThrownBy(() -> service.refreshToken(new RefreshTokenRequestDto("refresh")))
                .isInstanceOfSatisfying(ResponseStatusException.class, e ->
                        assertThat(e.getStatusCode().value()).isEqualTo(401));
    }

    @Test
    void refreshRejectsMissingEmailAndLogoutRevokesToken() {
        when(jwt.extractEmail("bad")).thenReturn(null);
        assertThatThrownBy(() -> service.refreshToken(new RefreshTokenRequestDto("bad")))
                .isInstanceOf(ResponseStatusException.class);

        Token token = Token.builder().token("access").user(user).build();
        when(tokens.findByToken("access")).thenReturn(Optional.of(token));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer access");
        assertThat(service.logoutUser(request).getMessage()).contains("Logged out");
        assertThat(token.isRevoked()).isTrue();
        assertThat(token.isExpired()).isTrue();
        verify(tokens).save(token);
    }
}
