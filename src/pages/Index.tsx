// Update this page (the content is just a fallback if you fail to update the page)

// Update the current index page to redirect to login
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if trainer is logged in
    const trainerData = localStorage.getItem("trainer");
    if (trainerData) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  }, [navigate]);

  return null;
};

export default Index;
