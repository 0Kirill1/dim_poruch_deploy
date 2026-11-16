package dimporuchbe.user.api.controllers;

import dimporuchbe.user.api.dtos.ChangePasswordRequestDto;
import dimporuchbe.user.api.dtos.UserProfileDto;
import dimporuchbe.user.application.UserService;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/me")
@RequiredArgsConstructor
@Tag(name = "Profile", description = "Operations for the authenticated user's profile")
@SecurityRequirement(name = "bearerAuth")
public class ProfileController {
    private final UserService userService;

    @GetMapping
    @Operation(summary = "Get my profile")
    @ApiResponse(responseCode = "200", description = "Profile returned",
            content = @Content(schema = @Schema(implementation = UserProfileDto.class)))
    public ResponseEntity<UserProfileDto> getUserProfile(@AuthenticationPrincipal UserDetails userDetails){
        return ResponseEntity.ok(userService.getUser(userDetails.getUsername()));
    }

    @PutMapping
    @Operation(summary = "Update my profile")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profile updated",
                    content = @Content(schema = @Schema(implementation = UserProfileDto.class))),
            @ApiResponse(responseCode = "400", description = "Invalid profile data"),
            @ApiResponse(responseCode = "409", description = "Email is already in use")
    })
    public ResponseEntity<UserProfileDto> updateProfile(@AuthenticationPrincipal UserDetails userDetails,
                                                        @Valid @RequestBody UserProfileDto dto){
        UserProfileDto responseDto = userService.updateProfile(userDetails.getUsername(), dto);
        return ResponseEntity.ok(responseDto);
    }

    @PatchMapping("/password")
    @Operation(summary = "Change my password")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Password changed successfully"),
            @ApiResponse(responseCode = "400", description = "Current password is incorrect or input is invalid")
    })
    public ResponseEntity<Map<String, String>> changePassword(@AuthenticationPrincipal UserDetails userDetails,
                                                              @Valid @RequestBody ChangePasswordRequestDto dto){
        userService.changePassword(userDetails.getUsername(), dto);
        return ResponseEntity.ok(Map.of("message", "Пароль успішно змінено"));
    }

    @DeleteMapping
    @Operation(summary = "Deactivate my account")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Account deactivated successfully"),
            @ApiResponse(responseCode = "404", description = "User not found")
    })
    public ResponseEntity<Map<String, String>> deactivateAccount(@AuthenticationPrincipal UserDetails userDetails){
        userService.deactivateAccount(userDetails.getUsername());
        return ResponseEntity.ok(Map.of("message", "Обліковий запис успішно деактивовано"));
    }
}
