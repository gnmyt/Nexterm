import Icon from "@mdi/react";
import { mdiBook, mdiPackageVariant } from "@mdi/js";
import Button from "@/common/components/Button";
import "./styles.sass";

export const StoreHeader = () => {
    return (
        <div className="store-header">
            <div className="store-title">
                <Icon path={mdiPackageVariant} />
                <div className="descriptor">
                    <h1>App Store</h1>
                    <p>Your favorite apps, deployed with a single click.</p>
                </div>
            </div>

            <Button text="Manage sources" icon={mdiBook}/>
        </div>
    )
}