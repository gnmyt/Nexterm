const ACCOUNT_VIEW_ATTRIBUTES = ["id", "username", "firstName", "lastName", "avatarHash"];

const toAccountView = (account) => account ? {
    id: account.id,
    username: account.username,
    firstName: account.firstName,
    lastName: account.lastName,
    avatarHash: account.avatarHash,
} : null;

module.exports = { ACCOUNT_VIEW_ATTRIBUTES, toAccountView };
