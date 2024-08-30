import IconInput from "@/common/components/IconInput";
import "./styles.sass";
import { mdiAccountCircleOutline } from "@mdi/js";
import { useContext } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Button from "@/common/components/Button/index.js";

export const Account = () => {

    const { user } = useContext(UserContext);

    return (
        <div className="account-page">
            <div className="account-section">
                <h2>Account name</h2>
                <div className="section-inner">
                    <div className="form-group">
                        <label htmlFor="name">First name</label>
                        <IconInput icon={mdiAccountCircleOutline} placeholder="First name"
                                   value={user?.firstName} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="name">Last name</label>
                        <IconInput icon={mdiAccountCircleOutline} placeholder="Last name"
                                   value={user?.lastName} />
                    </div>
                </div>
            </div>

            <div className="account-section">
                <h2>Two-factor authentication</h2>
                <div className="section-inner">
                    <p style={{ maxWidth: "25rem" }}>Add an extra layer of security to your account by enabling
                        two-factor authentication.</p>
                    <Button text="Enable 2FA" />
                </div>
            </div>

            <div className="account-section">
                <h2>Change password</h2>
                <div className="section-inner">
                    <p style={{ maxWidth: "25rem" }}>Choose a new and secure password for your account here.</p>

                    <Button text="Change password" />
                </div>
            </div>

        </div>
    );
};