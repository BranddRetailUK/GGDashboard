import { createContext, useState, useContext, useEffect } from 'react';

const TagContext = createContext();
export const useTag = () => useContext(TagContext);

export const TagProvider = ({ children }) => {
  const [tag, setTag] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('accessToken');
    const shop = import.meta.env.VITE_SHOP_DOMAIN;
    const backend = import.meta.env.VITE_BACKEND_URL;

    console.log('🧠 TagContext useEffect fired');
    console.log('📦 LocalStorage:', { email, token });
    console.log('🌍 Env:', { shop, backend });

    if (!email || !token || !shop || !backend) {
      console.warn("⚠️ Missing auth token, email, or environment variables — skipping fetch.");
      setLoading(false);
      return;
    }

    const fetchCustomer = async () => {
      try {
        const url = `${backend}/api/customer?shop=${shop}&email=${email}&token=${token}`;
        console.log('📡 Fetching customer from:', url);

        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`🚫 Failed fetch. Status: ${response.status}`);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("🎉 Customer data loaded:", data);

        if (data?.customer) {
          setCustomer(data.customer);
          setTag(data.customer.tag || null);
        } else {
          console.warn("⚠️ No customer object found in response:", data);
        }
      } catch (error) {
        console.error("❌ Error fetching customer data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, []);

  return (
    <TagContext.Provider value={{ tag, customer, loading }}>
      {children}
    </TagContext.Provider>
  );
};
