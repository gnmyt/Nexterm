import { DialogProvider } from "@/common/components/Dialog";
import { useState, useEffect } from "react";
import Button from "@/common/components/Button";
import IconInput from "@/common/components/IconInput";
import { mdiFormTextbox, mdiSend, mdiClose, mdiFormTextboxPassword, mdiLock } from "@mdi/js";
import Icon from "@mdi/react";
import "./InputDialog.sass";

const InputDialog = ({ open, onSubmit, prompt }) => {
    const [inputValue, setInputValue] = useState("");

    useEffect(() => {
        if (prompt) setInputValue(prompt.default || "");
    }, [prompt]);

    const handleSubmit = () => {
        onSubmit(inputValue);
        setInputValue("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSubmit();
    };

    const selectOption = (option) => onSubmit(option);

    if (!prompt) return null;

    const promptType = prompt.inputType || prompt.type || "input";

    return (
        <DialogProvider open={open} onClose={() => {}} disableClosing={true}>
            <div className="input-dialog">
                <div className="dialog-title">
                    <Icon path={promptType === "password" ? mdiFormTextboxPassword : mdiFormTextbox} />
                    <h2>Input Required</h2>
                </div>

                <div className="dialog-content">
                    <div className="prompt-description">
                        {prompt.prompt}
                    </div>

                    {promptType === "select" ? (
                        <div className="form-group">
                            <label>Select an option</label>
                            <div className="options-container">
                                {prompt.options.map((option, index) => (
                                    <Button key={index} text={option} onClick={() => selectOption(option)} type="secondary" />
                                ))}
                            </div>
                        </div>
                    ) : promptType === "confirm" ? (
                        <div className="form-group">
                            <label>Confirm action</label>
                            <div className="confirm-actions">
                                <Button text="Yes" icon={mdiSend} onClick={() => selectOption("Yes")} />
                                <Button text="No" icon={mdiClose} onClick={() => selectOption("No")} type="secondary" />
                            </div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label>Enter value</label>
                            <IconInput
                                type={promptType === "password" ? "password" : "text"}
                                icon={promptType === "password" ? mdiLock : mdiFormTextbox}
                                value={inputValue}
                                setValue={setInputValue}
                                placeholder={promptType === "password" ? "Enter password..." : (prompt.default || "Enter value...")}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {(promptType !== "select" && promptType !== "confirm") && (
                    <div className="dialog-actions">
                        <Button onClick={handleSubmit} text="Submit" icon={mdiSend}
                                disabled={promptType === "password" ? !inputValue : !inputValue.trim()} />
                    </div>
                )}
            </div>
        </DialogProvider>
    );
};

export default InputDialog;
