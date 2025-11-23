import "./styles.sass";
import { useState, useEffect, useMemo } from "react";
import { useSnippets } from "@/common/contexts/SnippetContext.jsx";
import { useScripts } from "@/common/contexts/ScriptContext.jsx";
import SnippetsList from "@/pages/Snippets/components/SnippetsList";
import SnippetDialog from "@/pages/Snippets/components/SnippetDialog";
import ScriptsList from "@/pages/Snippets/components/ScriptsList";
import ScriptDialog from "@/pages/Snippets/components/ScriptDialog";
import Button from "@/common/components/Button";
import PageHeader from "@/common/components/PageHeader";
import SelectBox from "@/common/components/SelectBox";
import { mdiCodeBraces, mdiPlus, mdiScriptText } from "@mdi/js";
import { useTranslation } from "react-i18next";
import { getRequest } from "@/common/utils/RequestUtil.js";

export const Snippets = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(0); // 0 = snippets, 1 = scripts
    const [snippetDialogOpen, setSnippetDialogOpen] = useState(false);
    const [scriptDialogOpen, setScriptDialogOpen] = useState(false);
    const [editSnippetId, setEditSnippetId] = useState(null);
    const [editScriptId, setEditScriptId] = useState(null);
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrganization, setSelectedOrganization] = useState(null);
    const { allSnippets } = useSnippets();
    const { scripts, loadScripts } = useScripts();

    const snippets = useMemo(() => {
        if (!allSnippets || allSnippets.length === 0) return [];
        
        if (selectedOrganization === null) {
            return allSnippets.filter(snippet => snippet.organizationId === null);
        }
        
        return allSnippets.filter(snippet => snippet.organizationId === selectedOrganization);
    }, [allSnippets, selectedOrganization]);

    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                const orgs = await getRequest("organizations");
                setOrganizations(orgs);
            } catch (error) {
                console.error("Failed to load organizations", error);
            }
        };
        fetchOrganizations();
    }, []);

    useEffect(() => {
        if (selectedOrganization) {
            loadScripts(selectedOrganization);
        } else {
            loadScripts();
        }
    }, [selectedOrganization]);

    const organizationOptions = [
        { value: null, label: t('snippets.page.personal'), icon: null },
        ...organizations.map(org => ({ value: org.id, label: org.name, icon: null }))
    ];

    const openCreateSnippetDialog = () => {
        setEditSnippetId(null);
        setSnippetDialogOpen(true);
    };

    const openEditSnippetDialog = (id) => {
        setEditSnippetId(id);
        setSnippetDialogOpen(true);
    };

    const closeSnippetDialog = () => {
        setSnippetDialogOpen(false);
        setEditSnippetId(null);
    };

    const openCreateScriptDialog = () => {
        setEditScriptId(null);
        setScriptDialogOpen(true);
    };

    const openEditScriptDialog = (id) => {
        setEditScriptId(id);
        setScriptDialogOpen(true);
    };

    const closeScriptDialog = () => {
        setScriptDialogOpen(false);
        setEditScriptId(null);
    };

    const handleCreateClick = () => {
        if (activeTab === 0) {
            openCreateSnippetDialog();
        } else {
            openCreateScriptDialog();
        }
    };

    return (
        <div className="snippets-page">
            <PageHeader
                icon={activeTab === 0 ? mdiCodeBraces : mdiScriptText}
                title={activeTab === 0 ? t('snippets.page.title') : t('scripts.page.title')}
                subtitle={activeTab === 0 ? t('snippets.page.subtitle') : t('scripts.page.subtitle')}>
                <Button 
                    text={activeTab === 0 ? t('snippets.page.addSnippet') : t('scripts.page.addScript')} 
                    icon={mdiPlus} 
                    onClick={handleCreateClick} 
                />
            </PageHeader>

            <hr className="snippets-header-divider" />

            <div className="snippets-content-wrapper">
                <div className="snippets-controls">
                    <div className="snippets-tabs">
                        <div 
                            className={`tabs-item ${activeTab === 0 ? "tabs-item-active" : ""}`}
                            onClick={() => setActiveTab(0)}
                        >
                            <h3>{t('snippets.page.tabs.snippets')}</h3>
                        </div>
                        <div 
                            className={`tabs-item ${activeTab === 1 ? "tabs-item-active" : ""}`}
                            onClick={() => setActiveTab(1)}
                        >
                            <h3>{t('scripts.page.tabs.scripts')}</h3>
                        </div>
                    </div>

                    <div className="organization-selector">
                        <SelectBox
                            options={organizationOptions}
                            selected={selectedOrganization}
                            setSelected={setSelectedOrganization}
                        />
                    </div>
                </div>

                <div className="snippets-content">
                    {activeTab === 0 && <SnippetsList snippets={snippets} onEdit={openEditSnippetDialog} selectedOrganization={selectedOrganization} />}
                    {activeTab === 1 && <ScriptsList scripts={scripts} onEdit={openEditScriptDialog} selectedOrganization={selectedOrganization} />}
                </div>
            </div>

            <SnippetDialog open={snippetDialogOpen} onClose={closeSnippetDialog} editSnippetId={editSnippetId} selectedOrganization={selectedOrganization} />
            <ScriptDialog open={scriptDialogOpen} onClose={closeScriptDialog} editScriptId={editScriptId} selectedOrganization={selectedOrganization} />
        </div>
    );
};