import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect } from "react";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { mdiFormTextbox, mdiSend, mdiClose, mdiHelpCircle, mdiLock } from "@mdi/js";
import Icon from "@mdi/react";
import "./styles.sass";

export const InputDialog = ({ open, onSubmit, prompt }) => {
    const [inputValue, setInputValue] = useState("");

    useEffect(() => {
        if (prompt) setInputValue(prompt.default || "");
    }, [prompt]);

    const handleSubmit = () => {
        onSubmit(inputValue);
        setInputValue("");
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") handleSubmit();
    };

    const selectOption = (option) => onSubmit(option);

    if (!prompt) return null;

    return (
        <DialogProvider open={open} onClose={() => {
        }} disableClosing={true}>
            <div className="input-dialog">
                <div className="dialog-title">
                    <Icon path={mdiHelpCircle} />
                    <h2>Script Input Required</h2>
                </div>

                <div className="dialog-content">
                    <div className="prompt-description">
                        {prompt.prompt}
                    </div>

                    {prompt.type === "select" ? (
                        <div className="form-group">
                            <label>Please select an option:</label>
                            <div className="options-container">
                                {prompt.options.map((option, index) => (
                                    <Button key={index} text={option} onClick={() => selectOption(option)} type="secondary" />
                                ))}
                            </div>
                        </div>
                    ) : prompt.type === "confirm" ? (
                        <div className="form-group">
                            <label>Please confirm:</label>
                            <div className="confirm-actions">
                                <Button text="Yes" icon={mdiSend} onClick={() => selectOption("Yes")} />
                                <Button text="No" icon={mdiClose} onClick={() => selectOption("No")} type="secondary" />
                            </div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>Please enter a value:</label>
                            <IconInput
                                type={prompt.type === "password" ? "password" : "text"}
                                icon={prompt.type === "password" ? mdiLock : mdiFormTextbox}
                                value={inputValue}
                                setValue={setInputValue}
                                placeholder={prompt.type === "password" ? "Enter password..." : (prompt.default || "Enter value...")}
                                onKeyPress={handleKeyPress}
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {(prompt.type !== "select" && prompt.type !== "confirm") && (
                    <div className="dialog-actions">
                        <Button onClick={handleSubmit} text="Submit" icon={mdiSend}
                                disabled={prompt.type === "password" ? !inputValue : !inputValue.trim()} />
                    </div>
                )}
            </div>
        </DialogProvider>
    );
};
