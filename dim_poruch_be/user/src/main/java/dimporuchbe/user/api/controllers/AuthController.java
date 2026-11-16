package dimporuchbe.user.api.controllers;

import dimporuchbe.user.api.dtos.LoginRequestDto;
import dimporuchbe.user.api.dtos.RegisterRequestDto;
import dimporuchbe.user.api.dtos.LogoutResponseDto;
import dimporuchbe.user.api.dtos.RefreshTokenRequestDto;
import dimporuchbe.user.api.dtos.LoginResponseDto;
import dimporuchbe.user.api.dtos.RegisterResponseDto;
import dimporuchbe.user.application.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Registration, login, token refresh, and logout operations")
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register a user", description = "Creates a tenant or landlord account.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "User registered successfully",
                    content = @Content(schema = @Schema(implementation = RegisterResponseDto.class))),
            @ApiResponse(responseCode = "400", description = "Invalid registration data"),
            @ApiResponse(responseCode = "409", description = "Email is already in use")
    })
    public ResponseEntity<RegisterResponseDto> register(@Valid @RequestBody RegisterRequestDto registerRequestDto){
        RegisterResponseDto registerResponseDto = authService.registerUser(registerRequestDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(registerResponseDto);
    }

    @PostMapping("/login")
    @Operation(summary = "Log in", description = "Authenticates a user and returns access and refresh tokens.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful",
                    content = @Content(schema = @Schema(implementation = LoginResponseDto.class))),
            @ApiResponse(responseCode = "401", description = "Invalid credentials"),
            @ApiResponse(responseCode = "403", description = "Account is disabled")
    })
    public ResponseEntity<LoginResponseDto> login(@Valid @RequestBody LoginRequestDto loginRequestDto){
        LoginResponseDto loginResponseDto = authService.loginUser(loginRequestDto);
        return ResponseEntity.ok(loginResponseDto);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh an access token")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Access token refreshed",
                    content = @Content(schema = @Schema(implementation = LoginResponseDto.class))),
            @ApiResponse(responseCode = "400", description = "Refresh token is missing"),
            @ApiResponse(responseCode = "401", description = "Refresh token is invalid, expired, or revoked")
    })
    public ResponseEntity<LoginResponseDto> refresh(@Valid @RequestBody RefreshTokenRequestDto refreshTokenRequestDto){
        LoginResponseDto response = authService.refreshToken(refreshTokenRequestDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "Log out", description = "Revokes the access token supplied in the Authorization header.")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Logged out successfully",
                    content = @Content(schema = @Schema(implementation = LogoutResponseDto.class))),
            @ApiResponse(responseCode = "400", description = "Missing, invalid, or unknown access token")
    })
    public ResponseEntity<LogoutResponseDto> logout(HttpServletRequest request){
        LogoutResponseDto logoutResponseDto = authService.logoutUser(request);
        return ResponseEntity.ok(logoutResponseDto);
    }
}
