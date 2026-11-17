import { useTranslation } from "react-i18next";
import Icon from "@mdi/react";
import { mdiChevronUp, mdiEyeOutline, mdiShieldCheckOutline, mdiShieldOutline } from "@mdi/js";
import { ContextMenu, ContextMenuItem, useContextMenu } from "@/common/components/ContextMenu";
import { APPROVAL_MODES } from "@/common/contexts/AIContext.jsx";
import { toggleMenuAbove } from "../../utils.js";
import "./styles.sass";

const APPROVAL_ICONS = { ask: mdiShieldOutline, allow: mdiShieldCheckOutline, readonly: mdiEyeOutline };

export const ApprovalMenu = ({ mode, onSelect }) => {
    const { t } = useTranslation();
    const menu = useContextMenu();

    return (
        <>
            <button type="button" className={`ai-composer-mode mode-${mode}${menu.isOpen ? " active" : ""}`}
                    title={t(`servers.aiAssistant.approval.${mode}Description`)} onClick={(e) => toggleMenuAbove(menu, e)}>
                <Icon path={APPROVAL_ICONS[mode] || mdiShieldOutline} />
                <span>{t(`servers.aiAssistant.approval.${mode}`)}</span>
                <Icon className="caret" path={mdiChevronUp} />
            </button>
            <ContextMenu isOpen={menu.isOpen} position={menu.position} onClose={menu.close} trigger={menu.triggerRef}
                         placement="above" className="ai-approval-menu">
                {APPROVAL_MODES.map((value) => (
                    <ContextMenuItem key={value} icon={APPROVAL_ICONS[value]} checked={mode === value} onClose={menu.close}
                                     onClick={() => onSelect(value)} label={t(`servers.aiAssistant.approval.${value}`)}
                                     description={t(`servers.aiAssistant.approval.${value}Description`)} />
                ))}
            </ContextMenu>
        </>
    );
};
