/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Scan, 
  Camera,
  Search,
  Package,
  Plus,
  CheckCircle,
  AlertCircle,
  History,
  Download,
  Upload
} from "lucide-react";

type ScannerProduct = {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  minStock: number;
};

type ScanResult =
  | {
      success: true;
      product: ScannerProduct;
      message: string;
    }
  | {
      success: false;
      message: string;
      code?: string;
    };

const ScannerManagement = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recentScans = [
    {
      id: "SC001",
      code: "7501001234567",
      product: "Whisky Buchanans 18 Años",
      timestamp: "2024-01-10 14:30",
      action: "inventory_check",
      result: "found",
      stock: 15
    },
    {
      id: "SC002",
      code: "8410001234568",
      product: "Vino Tinto Marqués de Cáceres",
      timestamp: "2024-01-10 14:15",
      action: "add_stock",
      result: "updated",
      stock: 23
    },
    {
      id: "SC003",
      code: "7501987654321",
      product: "Ron Zacapa 23 Años",
      timestamp: "2024-01-10 13:45",
      action: "sale",
      result: "sold",
      stock: 2
    },
    {
      id: "SC004",
      code: "1234567890123",
      product: "Producto No Encontrado",
      timestamp: "2024-01-10 13:20",
      action: "lookup",
      result: "not_found",
      stock: 0
    }
  ];

  const scanStats = {
    totalScans: 245,
    todayScans: 12,
    successRate: 94.5,
    newProducts: 3
  };

  const mockProducts: ScannerProduct[] = [
    {
      barcode: "7501001234567",
      name: "Whisky Buchanans 18 Años",
      brand: "Buchanans",
      category: "Whisky",
      price: 850.00,
      stock: 15,
      minStock: 5
    },
    {
      barcode: "8410001234568", 
      name: "Vino Tinto Marqués de Cáceres Reserva",
      brand: "Marqués de Cáceres",
      category: "Vinos",
      price: 280.00,
      stock: 23,
      minStock: 10
    }
  ];

  const handleManualScan = () => {
    if (scannedCode.trim()) {
      const product = mockProducts.find(p => p.barcode === scannedCode);
      if (product) {
        setScanResult({
          success: true,
          product: product,
          message: "Producto encontrado exitosamente"
        });
      } else {
        setScanResult({
          success: false,
          message: "Producto no encontrado en la base de datos",
          code: scannedCode
        });
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Simular procesamiento de imagen
      setTimeout(() => {
        const randomProduct = mockProducts[Math.floor(Math.random() * mockProducts.length)];
        setScanResult({
          success: true,
          product: randomProduct,
          message: "Código escaneado desde imagen"
        });
        setScannedCode(randomProduct.barcode);
      }, 2000);
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "found":
      case "updated":
      case "sold":
        return <Badge className="bg-liquor-gold text-liquor-bronze">Exitoso</Badge>;
      case "not_found":
        return <Badge variant="destructive">No Encontrado</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case "inventory_check":
        return "Verificación";
      case "add_stock":
        return "Agregar Stock";
      case "sale":
        return "Venta";
      case "lookup":
        return "Búsqueda";
      default:
        return "Desconocido";
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Scanner de Códigos</h2>
          <p className="text-muted-foreground">Escanea códigos de barras y QR para gestión rápida</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar Historial
          </Button>
        </div>
      </div>

      {/* Estadísticas del Scanner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="animate-slide-up">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Escaneados</p>
                <p className="text-2xl font-bold text-foreground">{scanStats.totalScans}</p>
              </div>
              <Scan className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hoy</p>
                <p className="text-2xl font-bold text-foreground">{scanStats.todayScans}</p>
              </div>
              <History className="w-8 h-8 text-liquor-gold" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Éxito</p>
                <p className="text-2xl font-bold text-foreground">{scanStats.successRate}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: "300ms" }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Productos Nuevos</p>
                <p className="text-2xl font-bold text-foreground">{scanStats.newProducts}</p>
              </div>
              <Plus className="w-8 h-8 text-liquor-burgundy" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Escaneado */}
        <Card className="animate-bounce-in">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Scan className="w-5 h-5 mr-2" />
              Scanner Principal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scanner de Cámara */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              {isScanning ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-primary rounded-lg flex items-center justify-center animate-pulse">
                    <Camera className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <p className="text-foreground">Escaneando código...</p>
                  <Button variant="outline" onClick={() => setIsScanning(false)}>
                    Detener
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Camera className="w-16 h-16 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Presiona para activar la cámara</p>
                  <Button 
                    className="bg-primary hover:opacity-90"
                    onClick={() => setIsScanning(true)}
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    Iniciar Escaneado
                  </Button>
                </div>
              )}
            </div>

            {/* Entrada Manual */}
            <div className="space-y-3">
              <div className="flex space-x-2">
                <Input
                  placeholder="Ingresar código manualmente..."
                  value={scannedCode}
                  onChange={(e) => setScannedCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                />
                <Button onClick={handleManualScan}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Upload de Imagen */}
              <div className="flex space-x-2">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Imagen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultado del Escaneo */}
        <Card className="animate-bounce-in" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Resultado del Escaneo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scanResult ? (
              <div className="space-y-4">
                {scanResult.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-liquor-gold" />
                      <span className="text-liquor-gold font-medium">{scanResult.message}</span>
                    </div>
                    
                    <div className="bg-muted rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-foreground">{scanResult.product.name}</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Marca:</span>
                          <p className="font-medium text-foreground">{scanResult.product.brand}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Categoría:</span>
                          <p className="font-medium text-foreground">{scanResult.product.category}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Precio:</span>
                          <p className="font-medium text-foreground">Q {scanResult.product.price.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Stock:</span>
                          <p className="font-medium text-foreground">{scanResult.product.stock} unidades</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Código: {scanResult.product.barcode}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button size="sm" className="bg-primary hover:opacity-90">
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar Stock
                      </Button>
                      <Button variant="outline" size="sm">
                        <Package className="w-3 h-3 mr-1" />
                        Ver Producto
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <span className="text-destructive font-medium">{scanResult.message}</span>
                    </div>
                    
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-2">Código escaneado:</p>
                      <p className="font-mono text-foreground">{scanResult.code}</p>
                    </div>

                    <Button className="w-full bg-primary hover:opacity-90">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Nuevo Producto
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay resultados de escaneo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Escanea un código para ver la información del producto
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial de Escaneos */}
      <Card className="animate-bounce-in" style={{ animationDelay: "400ms" }}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="w-5 h-5 mr-2" />
            Historial de Escaneos Recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-muted-foreground">Código</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Producto</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Acción</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Resultado</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Fecha/Hora</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan, index) => (
                  <tr 
                    key={scan.id} 
                    className="border-b border-border hover:bg-muted transition-colors"
                  >
                    <td className="p-3">
                      <span className="font-mono text-sm text-foreground">{scan.code}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-foreground">{scan.product}</span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">{getActionText(scan.action)}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      {getResultBadge(scan.result)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-foreground">{scan.stock}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-foreground">{scan.timestamp}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScannerManagement;