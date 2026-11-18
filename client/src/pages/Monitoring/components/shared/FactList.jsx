import { EMPTY } from "./status.js";

export const FactList = ({ facts }) => (
    <dl className="mon-facts">
        {facts.map(fact => (
            <div key={fact.key} className={fact.alert ? "alert" : undefined}>
                <dt>{fact.label}</dt>
                <dd className={fact.mono ? "mono" : undefined}>{fact.value ?? EMPTY}</dd>
            </div>
        ))}
    </dl>
);
