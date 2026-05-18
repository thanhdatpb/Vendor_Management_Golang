<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function conversion()
    {
        return response()->json([
            "conversion_rate" => 3.2
        ]);
    }

    public function profit()
    {
        return response()->json([
            "profit" => 15000
        ]);
    }
}