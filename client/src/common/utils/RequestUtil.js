export const request = async (url, method, body, headers) => {
    url = url.startsWith("/") ? url.substring(1) : url;

    const response = await fetch(`/api/${url}`, {
        method: method,
        headers: {...headers, "Content-Type": "application/json"},
        body: JSON.stringify(body)
    });

    if (response.status === 401) throw new Error("Unauthorized");

    const rawData = await response.text();
    const data = rawData ? JSON.parse(rawData) : rawData.toString();

    if (data.code >= 300) throw data;

    if (!response.ok) throw data;

    return data;
}

const getToken = () => {
    return localStorage.getItem("overrideToken") || localStorage.getItem("sessionToken");
}

export const sessionRequest = (url, method, token, body) => {
    return request(url, method, body, {"Authorization": `Bearer ${token}`});
}

export const getRequest = (url) => {
    return sessionRequest(url, "GET", getToken());
}

export const postRequest = (url, body) => {
    return sessionRequest(url, "POST", getToken(), body);
}

export const putRequest = (url, body) => {
    return sessionRequest(url, "PUT", getToken(), body);
}

export const deleteRequest = (url) => {
    return sessionRequest(url, "DELETE", getToken());
}

export const patchRequest = (url, body) => {
    return sessionRequest(url, "PATCH", getToken(), body);
}