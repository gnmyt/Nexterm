import { useCallback, useState } from "react";
import { CertificateReviewDialog } from "./CertificateReview.jsx";

export const useCertificateReview = () => {
    const [request, setRequest] = useState(null);

    const reviewUntrusted = useCallback((error, retry) => {
        if (!error?.untrustedPeer) return false;
        setRequest({ peer: error.untrustedPeer, retry });
        return true;
    }, []);

    const close = () => setRequest(null);
    const accept = () => {
        close();
        request.retry(request.peer.fingerprint);
    };

    const certificateReviewDialog = <CertificateReviewDialog peer={request?.peer} onClose={close} onAccept={accept} />;

    return { reviewUntrusted, certificateReviewDialog };
};
