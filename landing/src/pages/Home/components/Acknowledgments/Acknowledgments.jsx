import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faHeart} from "@fortawesome/free-solid-svg-icons";

export const Acknowledgments = () => {
    return (
        <section className="acknowledgments">
            <div className="acknowledgments-content">
                <div className="acknowledgments-icon">
                    <FontAwesomeIcon icon={faHeart}/>
                </div>
                
                <h2>Special Thanks</h2>
                
                <p className="acknowledgments-text">
                    Nexterm wouldn't be possible without the incredible work of the
                    <a href="https://guacamole.apache.org/" target="_blank" rel="noopener noreferrer">
                        Apache Guacamole
                    </a>
                    project, whose clientless remote desktop gateway powers our core connectivity,
                    and all the amazing
                    <a href="https://github.com/gnmyt/Nexterm/graphs/contributors" target="_blank" rel="noopener noreferrer">
                        Nexterm contributors
                    </a>
                    who help make this project better every day.
                </p>
            </div>
        </section>
    )
}
