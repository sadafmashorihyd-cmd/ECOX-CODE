'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EcoXGlobe from './EcoGlobe';

export default function Home() {
    const router = useRouter();
    useEffect(() => {
        const token = localStorage.getItem('gv_token');
        if (!token) router.push('/auth');
    }, [router]);
    return <EcoXGlobe />;
}