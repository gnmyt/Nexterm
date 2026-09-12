const {
    login,
    logout
} = require("./auth");
const Account = require("../models/Account");
const Session = require("../models/Session");
const OIDCProvider = require("../models/OIDCProvider");
const logger = require("../utils/logger");
const stateBroadcaster = require("../lib/StateBroadcaster");
const sessionManager = require("../lib/SessionManager");

jest.mock("../models/Account");
jest.mock("../models/Session");
jest.mock("../models/OIDCProvider");
jest.mock("speakeasy");
jest.mock("bcrypt", () => ({
    compare: jest.fn()
}));
jest.mock("../utils/logger");
jest.mock("../lib/StateBroadcaster");
jest.mock("../lib/SessionManager");
jest.mock("../controllers/ldap", () => ({
    authenticateUser: jest.fn(),
    getEnabledProvider: jest.fn()
}));

const { compare } = require("bcrypt");
const { authenticateUser: ldapAuth, getEnabledProvider: getLdapProvider } = require("../controllers/ldap");

describe("auth controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("login", () => {
        const defaultUser = { ip: "127.0.0.1", userAgent: "test-agent" };

        describe("when no provider is enabled", () => {
            it("returns 403 when both internal and LDAP providers are disabled", async () => {
                OIDCProvider.findOne.mockResolvedValue(null);
                getLdapProvider.mockResolvedValue(null);

                const result = await login(
                    { username: "testuser", password: "testpass" },
                    defaultUser
                );

                expect(result.code).toBe(403);
                expect(result.message).toBe("No login method is enabled");
            });
        });

        describe("when LDAP provider is enabled", () => {
            const ldapProvider = { id: 1, name: "LDAP", enabled: true };

            it("returns LDAP result on successful authentication", async () => {
                OIDCProvider.findOne.mockResolvedValue(null);
                getLdapProvider.mockResolvedValue(ldapProvider);
                ldapAuth.mockResolvedValue({ token: "ldap-token", totpRequired: false });

                const result = await login(
                    { username: "ldapuser", password: "ldappass" },
                    defaultUser
                );

                expect(ldapAuth).toHaveBeenCalledWith("ldapuser", "ldappass", defaultUser);
                expect(result.token).toBe("ldap-token");
                expect(result.totpRequired).toBe(false);
            });

            it("returns 201 on LDAP authentication failure", async () => {
                OIDCProvider.findOne.mockResolvedValue(null);
                getLdapProvider.mockResolvedValue(ldapProvider);
                ldapAuth.mockResolvedValue(null);

                const result = await login(
                    { username: "ldapuser", password: "wrongpass" },
                    defaultUser
                );

                expect(result.code).toBe(201);
                expect(result.message).toBe("Username or password incorrect");
            });
        });

        describe("when internal provider is enabled", () => {
            const internalProvider = { id: 1, isInternal: true, enabled: true };

            beforeEach(() => {
                OIDCProvider.findOne.mockResolvedValue(internalProvider);
                getLdapProvider.mockResolvedValue(null);
            });

            describe("account not found", () => {
                it("returns 201", async () => {
                    Account.findOne.mockResolvedValue(null);

                    const result = await login(
                        { username: "nonexistent", password: "anypass" },
                        defaultUser
                    );

                    expect(result.code).toBe(201);
                    expect(result.message).toBe("Username or password incorrect");
                });
            });

            describe("wrong password", () => {
                it("returns 201", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: false
                    });
                    compare.mockResolvedValue(false);

                    const result = await login(
                        { username: "testuser", password: "wrongpass" },
                        defaultUser
                    );

                    expect(result.code).toBe(201);
                    expect(result.message).toBe("Username or password incorrect");
                });
            });

            describe("TOTP required but missing", () => {
                it("returns 202", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: true,
                        totpSecret: "SECRET"
                    });
                    compare.mockResolvedValue(true);

                    const result = await login(
                        { username: "testuser", password: "correctpass" },
                        defaultUser
                    );

                    expect(result.code).toBe(202);
                    expect(result.message).toBe("TOTP is required for this account");
                });
            });

            describe("invalid TOTP code", () => {
                it("returns 203", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: true,
                        totpSecret: "SECRET"
                    });
                    compare.mockResolvedValue(true);
                    speakeasy.totp.verify.mockReturnValue(false);

                    const result = await login(
                        { username: "testuser", password: "correctpass", code: "invalid" },
                        defaultUser
                    );

                    expect(result.code).toBe(203);
                    expect(result.message).toBe("Your provided code is invalid or has expired.");
                });
            });

            describe("successful login", () => {
                const mockSession = {
                    id: 1,
                    token: "test-token-123",
                    accountId: 1,
                    ip: "127.0.0.1",
                    userAgent: "test-agent"
                };

                it("creates session with correct ip and userAgent", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: false
                    });
                    compare.mockResolvedValue(true);
                    Session.create.mockResolvedValue(mockSession);

                    await login(
                        { username: "testuser", password: "correctpass" },
                        defaultUser
                    );

                    expect(Session.create).toHaveBeenCalledWith({
                        accountId: 1,
                        ip: defaultUser.ip,
                        userAgent: defaultUser.userAgent
                    });
                });

                it("returns token and totpRequired false when TOTP is disabled", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: false
                    });
                    compare.mockResolvedValue(true);
                    Session.create.mockResolvedValue(mockSession);

                    const result = await login(
                        { username: "testuser", password: "correctpass" },
                        defaultUser
                    );

                    expect(result.token).toBe("test-token-123");
                    expect(result.totpRequired).toBe(false);
                });

                it("returns token and totpRequired true when TOTP is enabled", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: true,
                        totpSecret: "SECRET"
                    });
                    compare.mockResolvedValue(true);
                    speakeasy.totp.verify.mockReturnValue(true);
                    Session.create.mockResolvedValue(mockSession);

                    const result = await login(
                        { username: "testuser", password: "correctpass", code: "123456" },
                        defaultUser
                    );

                    expect(result.token).toBe("test-token-123");
                    expect(result.totpRequired).toBe(true);
                });

                it("verifies TOTP with correct secret and encoding", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: true,
                        totpSecret: "TESTSECRET"
                    });
                    compare.mockResolvedValue(true);
                    speakeasy.totp.verify.mockReturnValue(true);
                    Session.create.mockResolvedValue(mockSession);

                    await login(
                        { username: "testuser", password: "correctpass", code: "123456" },
                        defaultUser
                    );

                    expect(speakeasy.totp.verify).toHaveBeenCalledWith({
                        secret: "TESTSECRET",
                        encoding: "base32",
                        token: "123456"
                    });
                });

                it("logs successful login with account info", async () => {
                    Account.findOne.mockResolvedValue({
                        id: 1,
                        username: "testuser",
                        password: "hashedpass",
                        totpEnabled: false
                    });
                    compare.mockResolvedValue(true);
                    Session.create.mockResolvedValue(mockSession);

                    await login(
                        { username: "testuser", password: "correctpass" },
                        defaultUser
                    );

                    expect(logger.system).toHaveBeenCalledWith(
                        "User testuser logged in",
                        { accountId: 1, ip: defaultUser.ip }
                    );
                });
            });
        });
    });

    describe("logout", () => {
        it("returns 204 when session is not found", async () => {
            Session.findOne.mockResolvedValue(null);

            const result = await logout("invalid-token");

            expect(result.code).toBe(204);
            expect(result.message).toBe("Your session token is invalid");
        });

        it("destroys session and notifies managers on valid logout", async () => {
            const mockSession = { id: 1, accountId: 42, token: "valid-token" };
            Session.findOne.mockResolvedValue(mockSession);
            Session.destroy.mockResolvedValue(1);

            const result = await logout("valid-token");

            expect(Session.destroy).toHaveBeenCalledWith({ where: { token: "valid-token" } });
            expect(sessionManager.removeAllByAccountId).toHaveBeenCalledWith(42);
            expect(stateBroadcaster.forceLogoutSession).toHaveBeenCalledWith(1);
            expect(logger.system).toHaveBeenCalledWith(
                "User logged out",
                { accountId: 42 }
            );
            expect(result).toBeUndefined();
        });
    });
});
