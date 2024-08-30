import IconInput from "@/common/components/IconInput";
import "./styles.sass";
import { mdiAccountCircleOutline } from "@mdi/js";
import { useContext, useEffect, useState } from "react";
import { UserContext } from "@/common/contexts/UserContext.jsx";
import Button from "@/common/components/Button";
import { patchRequest } from "@/common/utils/RequestUtil.js";

export const Account = () => {

    const { user, login } = useContext(UserContext);

    const [updatedField, setUpdatedField] = useState(null);

    const [firstName, setFirstName] = useState(user?.firstName);
    const [lastName, setLastName] = useState(user?.lastName);

    const updateName = (config) => {
        if (config.firstName && config.firstName === user.firstName) return;
        if (config.lastName && config.lastName === user.lastName) return;

        patchRequest(`accounts/name`, config)
            .then(() => {
                login();
                setUpdatedField(Object.keys(config)[0]);

                setTimeout(() => {
                    setUpdatedField(null);
                }, 1500);
            })
            .catch(err => console.error(err));
    }

    useEffect(() => {
        setFirstName(user?.firstName);
        setLastName(user?.lastName);
    }, [user]);

    return (
        <div className="account-page">
            <div className="account-section">
                <h2>Account name</h2>
                <div className="section-inner">
                    <div className="form-group">
                        <label htmlFor="firstName">First name</label>
                        <IconInput icon={mdiAccountCircleOutline} placeholder="First name"
                                      name="firstName" customClass={updatedField === "firstName" ? " fd-updated" : ""}
                                   value={firstName} setValue={setFirstName}
                                   onBlur={(event) => updateName({ firstName: event.target.value })}   />
                    </div>

                    <div className="form-group">
                        <label htmlFor="lastName">Last name</label>
                        <IconInput icon={mdiAccountCircleOutline} placeholder="Last name" name="lastName"
                                      value={lastName} setValue={setLastName}
                                        customClass={updatedField === "lastName" ? " fd-updated" : ""}
                                   onBlur={(event) => updateName({ lastName: event.target.value })} />
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