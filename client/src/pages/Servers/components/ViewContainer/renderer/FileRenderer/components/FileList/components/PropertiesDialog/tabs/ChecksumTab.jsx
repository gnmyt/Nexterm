import { useTranslation } from "react-i18next";
import { mdiContentCopy, mdiCheck, mdiLoading, mdiCalculator } from "@mdi/js";
import Button from "@/common/components/Button/index.js";

const CHECKSUM_ALGORITHMS = ["md5", "sha1", "sha256", "sha512"];

export const ChecksumTab = ({
    checksums,
    loadingChecksum,
    copied,
    onCopy,
    onCalculate,
}) => {
    const { t } = useTranslation();

    return (
        <div className="properties-content checksum-content">
            {CHECKSUM_ALGORITHMS.map((algo) => (
                <div key={algo} className={`checksum-row ${checksums[algo] ? 'calculated' : ''}`}>
                    <span className="algo-label">{algo.toUpperCase()}</span>
                    {checksums[algo] ? (
                        <div className="checksum-value">
                            <code>{checksums[algo]}</code>
                            <Button icon={copied === algo ? mdiCheck : mdiContentCopy} onClick={() => onCopy(checksums[algo], algo)} type="primary" />
                        </div>
                    ) : (
                        <Button
                            icon={loadingChecksum[algo] ? mdiLoading : mdiCalculator}
                            text={loadingChecksum[algo] ? t("servers.fileManager.properties.calculating", "Calculating...") : t("servers.fileManager.properties.calculate", "Calculate")}
                            onClick={() => onCalculate(algo)}
                            disabled={loadingChecksum[algo]}
                            type="secondary"
                        />
                    )}
                </div>
            ))}
        </div>
    );
};
